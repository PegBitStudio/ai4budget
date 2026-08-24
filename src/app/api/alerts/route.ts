import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveAlerts } from '@/lib/alertEngine';
import { getCurrentMonthPeriod } from '@/utils/dateUtils';
import { SpendingAlert } from '@/models/alert';
import { Category } from '@/models/category';

/**
 * GET /api/alerts
 * Returns the authenticated user's active spending alerts for the current period.
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

    // Calculate current period start
    const period = getCurrentMonthPeriod();

    // Query spending alerts for this user filtered by period_start
    const { data: alertsData, error: queryError } = await supabase
      .from('spending_alerts')
      .select('*')
      .eq('period_start', period.start);

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch alerts', details: queryError.message },
        { status: 500 }
      );
    }

    // Cast and sort using the alert engine
    const typedAlerts: SpendingAlert[] = (alertsData ?? []).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      category: a.category as Category,
      type: a.type as 'warning' | 'exceeded',
      amount_spent: a.amount_spent,
      budgeted_amount: a.budgeted_amount,
      period_start: a.period_start,
      created_at: a.created_at,
    }));

    const alerts = getActiveAlerts(typedAlerts, period.start);

    return NextResponse.json({ alerts }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/alerts] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
