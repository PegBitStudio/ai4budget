import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateBudget,
  modifyAllocation,
  normalizeToMonthly,
  normalizeToWeekly,
  Frequency,
} from '@/lib/budgetEngine';
import { CATEGORIES, CategorySchema } from '@/models/category';
import { PeriodTypeSchema, CreateManualBudgetSchema } from '@/models/budget';
import {
  getCurrentMonthPeriod,
  getCurrentWeekPeriod,
  getPreviousPeriod,
} from '@/utils/dateUtils';
import type { Json } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

/**
 * What is actually left to divide across categories, after commitments and
 * savings — the same arithmetic generateBudget does internally. GET and
 * PATCH don't call generateBudget, but the page still needs this figure: an
 * edited allocation no longer forces the total back to it automatically, so
 * the page has to show it instead, or a fresh budget looks like two-thirds
 * of it went missing.
 */
async function getAvailableIncome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  totalIncome: number,
  periodType: 'weekly' | 'monthly'
): Promise<number> {
  const { data: commitments } = await supabase
    .from('commitments')
    .select('amount, frequency');

  const totalCommitments = (commitments ?? []).reduce((sum, c) => {
    const normalized =
      periodType === 'monthly'
        ? normalizeToMonthly(c.amount, c.frequency as Frequency)
        : normalizeToWeekly(c.amount, c.frequency as Frequency);
    return sum + normalized;
  }, 0);

  const { data: savingsGoals } = await supabase
    .from('savings_goals')
    .select('monthly_contribution');

  const monthlySavings = (savingsGoals ?? []).reduce(
    (sum, g) => sum + Number(g.monthly_contribution),
    0
  );
  const totalSavingsContribution =
    periodType === 'weekly'
      ? normalizeToWeekly(monthlySavings, 'monthly')
      : monthlySavings;

  return totalIncome - totalCommitments - totalSavingsContribution;
}

/**
 * POST /api/budget
 * Generate a new budget for the current period based on income,
 * commitments, savings goals, and historical spending.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const periodValidation = PeriodTypeSchema.safeParse(body?.period_type);

    if (!periodValidation.success) {
      return NextResponse.json(
        { error: 'Invalid period_type. Must be "weekly" or "monthly".' },
        { status: 400 }
      );
    }

    const periodType = periodValidation.data;

    // Calculate current period
    const currentPeriod =
      periodType === 'monthly'
        ? getCurrentMonthPeriod()
        : getCurrentWeekPeriod();

    // A budget built by hand — from scratch, or from an uploaded template —
    // skips every step below that derives numbers from transactions. Nothing
    // needs to have been logged yet; the categories left out of the request
    // simply start at 0.
    if (body?.mode === 'manual') {
      const manualValidation = CreateManualBudgetSchema.safeParse({
        period_type: body.period_type,
        total_income: body.total_income,
        allocations: body.allocations,
      });

      if (!manualValidation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: manualValidation.error.issues },
          { status: 400 }
        );
      }

      const given = new Map(
        manualValidation.data.allocations.map((a) => [a.category, a.amount])
      );
      const allocations = CATEGORIES.map((category) => ({
        category,
        amount: given.get(category) ?? 0,
        is_fixed: false,
      }));

      const suppliedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
      const totalIncome = manualValidation.data.total_income ?? suppliedTotal;

      const { data: manualBudget, error: manualInsertError } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          period_type: periodType,
          period_start: currentPeriod.start,
          period_end: currentPeriod.end,
          total_income: totalIncome,
          allocations: allocations as unknown as Json,
        })
        .select()
        .single();

      if (manualInsertError) {
        console.error('[POST /api/budget] Failed to store manual budget:', manualInsertError.message);
        return NextResponse.json(
          { error: 'Failed to store budget' },
          { status: 500 }
        );
      }

      const availableIncome = await getAvailableIncome(supabase, totalIncome, periodType);

      return NextResponse.json(
        { ...manualBudget, availableIncome },
        { status: 201 }
      );
    }

    // 1. Work out the income to divide up.
    //
    // Income is measured over the calendar month and then scaled to the target
    // period. Counting only what landed inside a given week gave payday week
    // an entire month's salary to spend and left the other three weeks with no
    // income at all, unable to budget.
    const incomeMonth = getCurrentMonthPeriod();

    const { data: incomeTransactions, error: incomeError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'income')
      .gte('date', incomeMonth.start)
      .lte('date', incomeMonth.end);

    if (incomeError) {
      console.error('[POST /api/budget] Failed to query income data:', incomeError.message);
      return NextResponse.json(
        { error: 'Failed to query income data' },
        { status: 500 }
      );
    }

    let monthlyIncome = (incomeTransactions ?? []).reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    // Early in a month, before payday, fall back to what last month brought in
    // rather than telling the user they have nothing to budget.
    if (monthlyIncome === 0) {
      const previousMonth = getPreviousPeriod(incomeMonth.start, 'monthly');
      const { data: lastMonthIncome } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'income')
        .gte('date', previousMonth.start)
        .lte('date', previousMonth.end);

      monthlyIncome = (lastMonthIncome ?? []).reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
    }

    const totalIncome =
      periodType === 'weekly'
        ? normalizeToWeekly(monthlyIncome, 'monthly')
        : monthlyIncome;

    // 2. Query user's financial commitments
    const { data: commitments, error: commitmentsError } = await supabase
      .from('commitments')
      .select('amount, frequency');

    if (commitmentsError) {
      console.error('[POST /api/budget] Failed to query commitments:', commitmentsError.message);
      return NextResponse.json(
        { error: 'Failed to query commitments' },
        { status: 500 }
      );
    }

    // 3. Query savings goals (sum of monthly_contribution)
    const { data: savingsGoals, error: savingsError } = await supabase
      .from('savings_goals')
      .select('monthly_contribution');

    if (savingsError) {
      console.error('[POST /api/budget] Failed to query savings goals:', savingsError.message);
      return NextResponse.json(
        { error: 'Failed to query savings goals' },
        { status: 500 }
      );
    }

    // Savings goals store a monthly contribution, so a weekly budget must take
    // a week's worth — not a whole month out of a single week's income.
    const monthlySavings = (savingsGoals ?? []).reduce(
      (sum, g) => sum + Number(g.monthly_contribution),
      0
    );
    const totalSavingsContribution =
      periodType === 'weekly'
        ? normalizeToWeekly(monthlySavings, 'monthly')
        : monthlySavings;

    // 4. Query historical spending to derive allocation proportions.
    //
    // Always a month of history, whatever the budget period. Only the
    // proportions are used, and they do not depend on the window length — but
    // a single previous week is far too thin a sample. One cinema ticket in a
    // quiet week produced a weekly budget that put 100% of income into
    // Entertainment.
    const previousPeriod = getPreviousPeriod(getCurrentMonthPeriod().start, 'monthly');

    let { data: historicalTransactions } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('type', 'expense')
      .gte('date', previousPeriod.start)
      .lte('date', previousPeriod.end);

    // A first-time user has no previous period, and the flat heuristic that
    // fills the gap allocates rent the same share as pharmacy visits — so the
    // very first budget they are shown is wrong about their largest cost.
    // Anything already recorded this period is better signal than nothing.
    if (!historicalTransactions || historicalTransactions.length === 0) {
      const thisMonth = getCurrentMonthPeriod();
      const { data: currentTransactions } = await supabase
        .from('transactions')
        .select('category, amount')
        .eq('type', 'expense')
        .gte('date', thisMonth.start)
        .lte('date', thisMonth.end);

      historicalTransactions = currentTransactions;
    }

    // Group historical spending by category
    let historicalSpending: { category: string; amount: number }[] | undefined;

    if (historicalTransactions && historicalTransactions.length > 0) {
      const categoryTotals = new Map<string, number>();
      for (const t of historicalTransactions) {
        const current = categoryTotals.get(t.category) ?? 0;
        categoryTotals.set(t.category, current + Number(t.amount));
      }
      historicalSpending = Array.from(categoryTotals.entries()).map(
        ([category, amount]) => ({ category, amount })
      );
    }

    // 5. Call generateBudget() from budgetEngine
    const budgetResult = generateBudget({
      totalIncome,
      commitments: (commitments ?? []).map((c) => ({
        amount: Number(c.amount),
        frequency: c.frequency as Frequency,
      })),
      savingsContribution: totalSavingsContribution,
      periodType,
      historicalSpending: historicalSpending as
        | { category: import('@/models/category').Category; amount: number }[]
        | undefined,
    });

    // 6. If the budget could not be built, say which situation stopped it
    if (!budgetResult.success) {
      return NextResponse.json(
        {
          error: budgetResult.error,
          shortfall: budgetResult.shortfall,
          reason: budgetResult.reason,
        },
        { status: 422 }
      );
    }

    // 7. Store the generated budget in the budgets table
    const { data: createdBudget, error: insertError } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        period_type: periodType,
        period_start: currentPeriod.start,
        period_end: currentPeriod.end,
        total_income: totalIncome,
        allocations: budgetResult.allocations as unknown as Json,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[POST /api/budget] Failed to store budget:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to store budget' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ...createdBudget, availableIncome: budgetResult.availableIncome },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/budget] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/budget
 * Retrieve the current budget for the authenticated user.
 * Query param: ?period_type=weekly|monthly (default: monthly)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const periodTypeParam = searchParams.get('period_type') ?? 'monthly';

    const periodValidation = PeriodTypeSchema.safeParse(periodTypeParam);
    if (!periodValidation.success) {
      return NextResponse.json(
        { error: 'Invalid period_type. Must be "weekly" or "monthly".' },
        { status: 400 }
      );
    }

    const periodType = periodValidation.data;

    // Calculate the current period
    const currentPeriod =
      periodType === 'monthly'
        ? getCurrentMonthPeriod()
        : getCurrentWeekPeriod();

    // Query the budgets table for the user matching the current period
    const { data: budget, error: queryError } = await supabase
      .from('budgets')
      .select('*')
      .eq('period_type', periodType)
      .eq('period_start', currentPeriod.start)
      .eq('period_end', currentPeriod.end)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('[GET /api/budget] Failed to fetch budget:', queryError.message);
      return NextResponse.json(
        { error: 'Failed to fetch budget' },
        { status: 500 }
      );
    }

    if (!budget) {
      return NextResponse.json(
        { error: 'No budget found for current period' },
        { status: 404 }
      );
    }

    const availableIncome = await getAvailableIncome(
      supabase,
      Number(budget.total_income),
      periodType
    );

    return NextResponse.json({ ...budget, availableIncome }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/budget] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/budget
 * Modify a single category allocation in the current budget.
 * Body: { category: Category, amount: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await request.json();

    const categoryValidation = CategorySchema.safeParse(body?.category);
    if (!categoryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const amount = body?.amount;
    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a non-negative number.' },
        { status: 400 }
      );
    }

    const category = categoryValidation.data;

    // Load the most recent budget for the user
    const { data: budget, error: queryError } = await supabase
      .from('budgets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('[PATCH /api/budget] Failed to fetch budget:', queryError.message);
      return NextResponse.json(
        { error: 'Failed to fetch budget' },
        { status: 500 }
      );
    }

    if (!budget) {
      return NextResponse.json(
        { error: 'No budget found for current period' },
        { status: 404 }
      );
    }

    // Call modifyAllocation from budgetEngine
    const currentAllocations = budget.allocations as Array<{
      category: string;
      amount: number;
      is_fixed: boolean;
    }>;

    const updatedAllocations = modifyAllocation(
      currentAllocations as import('@/models/budget').CategoryAllocation[],
      category,
      amount
    );

    // Update the budget in the database
    const { data: updatedBudget, error: updateError } = await supabase
      .from('budgets')
      .update({ allocations: updatedAllocations as unknown as Json })
      .eq('id', budget.id)
      .select()
      .single();

    if (updateError) {
      console.error('[PATCH /api/budget] Failed to update budget:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to update budget' },
        { status: 500 }
      );
    }

    const availableIncome = await getAvailableIncome(
      supabase,
      Number(updatedBudget.total_income),
      updatedBudget.period_type as 'weekly' | 'monthly'
    );

    return NextResponse.json(
      { ...updatedBudget, availableIncome },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/budget] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
