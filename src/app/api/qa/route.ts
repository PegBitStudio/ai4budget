import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { answerQuestion } from '@/lib/qaEngine';
import { getUserCurrency } from '@/lib/userCurrency';
import { getLLMClient } from '@/lib/llmClient';
import { getCurrentMonthPeriod } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/qa
 * Answers natural-language financial questions using local data and LLM fallback.
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
    let body: { question?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { question } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const currentPeriod = getCurrentMonthPeriod();

    // Query user's transactions for current period (limit 50)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, category, date, type')
      .gte('date', currentPeriod.start)
      .lte('date', currentPeriod.end)
      .order('date', { ascending: false })
      .limit(50);

    if (txError) {
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: txError.message },
        { status: 500 }
      );
    }

    // Query budget for current period
    const { data: budgets } = await supabase
      .from('budgets')
      .select('allocations')
      .lte('period_start', currentPeriod.end)
      .gte('period_end', currentPeriod.start)
      .order('created_at', { ascending: false })
      .limit(1);

    // Build budget comparison data
    let budgetData: { category: string; budgeted: number; actual: number }[] | undefined;
    if (budgets && budgets.length > 0) {
      const allocations = budgets[0].allocations as Array<{
        category: string;
        amount: number;
        is_fixed: boolean;
      }>;

      // Calculate actual spending per category
      const categorySpending = new Map<string, number>();
      for (const t of (transactions ?? []).filter((t) => t.type === 'expense')) {
        const current = categorySpending.get(t.category) ?? 0;
        categorySpending.set(t.category, current + t.amount);
      }

      budgetData = allocations.map((a) => ({
        category: a.category,
        budgeted: a.amount,
        actual: categorySpending.get(a.category) ?? 0,
      }));
    }

    // Call QA engine
    const llmClient = getLLMClient();
    const currency = await getUserCurrency();
    const result = await answerQuestion({
      symbol: currency.symbol,
      question: question.trim(),
      transactions: (transactions ?? []).map((t) => ({
        amount: t.amount,
        category: t.category,
        date: t.date,
        type: t.type,
      })),
      budget: budgetData,
      period: `${currentPeriod.start} to ${currentPeriod.end}`,
      llmClient,
    });

    return NextResponse.json({
      answer: result.answer,
      source: result.source,
      ...(result.needsClarification && { needsClarification: true }),
    });
  } catch (error) {
    console.error('[POST /api/qa] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
