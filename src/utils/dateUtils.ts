/**
 * Budget period calculation utilities.
 * All dates use ISO 8601 YYYY-MM-DD format.
 */

export interface DatePeriod {
  start: string;
  end: string;
}

/**
 * Returns the current month's period (1st to last day).
 */
export function getCurrentMonthPeriod(): DatePeriod {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const start = formatDate(new Date(year, month, 1));
  const end = formatDate(new Date(year, month + 1, 0));

  return { start, end };
}

/**
 * Returns the current week's period (Monday to Sunday).
 */
export function getCurrentWeekPeriod(): DatePeriod {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatDate(monday), end: formatDate(sunday) };
}

/**
 * Returns the period containing the given date for the specified period type.
 */
export function getPeriodForDate(
  date: string,
  periodType: 'weekly' | 'monthly'
): DatePeriod {
  const d = parseDate(date);

  if (periodType === 'monthly') {
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = formatDate(new Date(year, month, 1));
    const end = formatDate(new Date(year, month + 1, 0));
    return { start, end };
  }

  // Weekly: find Monday of the week containing this date
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatDate(monday), end: formatDate(sunday) };
}

/**
 * Returns the period immediately before the given one.
 */
export function getPreviousPeriod(
  periodStart: string,
  periodType: 'weekly' | 'monthly'
): DatePeriod {
  const d = parseDate(periodStart);

  if (periodType === 'monthly') {
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const start = formatDate(prevMonth);
    const end = formatDate(
      new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0)
    );
    return { start, end };
  }

  // Weekly: go back 7 days
  const prevMonday = new Date(d);
  prevMonday.setDate(d.getDate() - 7);

  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  return { start: formatDate(prevMonday), end: formatDate(prevSunday) };
}

/**
 * Returns the number of months between two dates (for savings calculations).
 * Rounds up to at least 1 if dates are in different months.
 */
export function getMonthsBetween(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();

  const months = yearDiff * 12 + monthDiff;
  return Math.max(0, months);
}

/**
 * Returns whether a date falls within the given period (inclusive).
 */
export function isWithinPeriod(
  date: string,
  periodStart: string,
  periodEnd: string
): boolean {
  return date >= periodStart && date <= periodEnd;
}

/**
 * Returns a human-readable date string (e.g., "15 Jun 2025").
 */
export function formatDateDisplay(date: string): string {
  const d = parseDate(date);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// --- Internal helpers ---

/**
 * Formats a Date object to ISO 8601 YYYY-MM-DD string.
 */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses an ISO 8601 YYYY-MM-DD string into a Date object.
 * Uses UTC-safe parsing to avoid timezone issues.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
