import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateSavingsGoalSchema } from '@/models/savingsGoal';
import { getRecommendation } from '@/lib/savingsAdvisor';
import { getCurrentMonthPeriod } from '@/utils/dateUtils';

/**
 * GET /api/savings
 * Returns the user's savings goals and a savings recommendation.
 */
export async function GET() {
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

    // Fetch savings goals
    const { data: goals, error: goalsError } = await supabase
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: false });

    if (goalsError) {
      return NextResponse.json(
        { error: 'Failed to fetch savings goals', details: goalsError.message },
        { status: 500 }
      );
    }

    // Fetch commitments to calculate total monthly commitments
    const { data: commitments } = await supabase
      .from('commitments')
      .select('amount, frequency');

    const totalMonthlyCommitments = (commitments ?? []).reduce((sum, c) => {
      return sum + toMonthlyAmount(c.amount, c.frequency);
    }, 0);

    // Fetch income transactions for the current month to estimate monthly income
    const period = getCurrentMonthPeriod();
    const { data: incomeTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'income')
      .gte('date', period.start)
      .lte('date', period.end);

    const monthlyIncome = (incomeTransactions ?? []).reduce(
      (sum, t) => sum + t.amount,
      0
    );

    const discretionaryIncome = Math.max(0, monthlyIncome - totalMonthlyCommitments);

    // Build recommendation params from the first (primary) savings goal
    const primaryGoal = goals && goals.length > 0 ? goals[0] : null;

    const recommendation = getRecommendation({
      savingsGoal: primaryGoal
        ? {
            targetAmount: primaryGoal.target_amount,
            currentAmount: primaryGoal.current_amount,
            deadline: primaryGoal.deadline ?? undefined,
          }
        : undefined,
      discretionaryIncome,
      averageMonthlyIncome: monthlyIncome > 0 ? monthlyIncome : undefined,
    });

    return NextResponse.json(
      { goals: goals ?? [], recommendation },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/savings] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/savings
 * Create a new savings goal.
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
    const validation = CreateSavingsGoalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { target_amount, deadline } = validation.data;

    // Insert savings goal
    const { data: goal, error: insertError } = await supabase
      .from('savings_goals')
      .insert({
        user_id: user.id,
        target_amount,
        deadline: deadline ?? null,
        current_amount: 0,
        monthly_contribution: 0,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create savings goal', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/savings] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/savings?id=UUID
 * Delete a savings goal by ID.
 */
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    // Delete the savings goal (RLS ensures user can only delete their own)
    const { data, error: deleteError } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (deleteError || !data) {
      return NextResponse.json(
        { error: 'Savings goal not found' },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[DELETE /api/savings] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// --- Helper: Convert frequency-based amount to monthly ---

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return amount * (52 / 12);
    case 'fortnightly':
      return amount * (26 / 12);
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}
