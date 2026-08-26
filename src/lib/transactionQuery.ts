/**
 * Turning a URL query string into a safe database query.
 *
 * Kept out of the route handler and pure, because two of these values reach
 * PostgREST as syntax rather than as data — the sort column names a column, and
 * the search term sits inside an `ilike` filter where a comma or a parenthesis
 * would end the value and start something else. Both are constrained here, once,
 * where they can be tested without a database.
 */

/** The only columns a caller may sort on. */
export const SORTABLE = ['date', 'amount', 'description', 'category'] as const;

export type SortKey = (typeof SORTABLE)[number];

export interface ListQuery {
  sort: SortKey;
  ascending: boolean;
  search: string | null;
  category: string | null;
  from: string | null;
  to: string | null;
  type: 'income' | 'expense' | null;
  limit: number;
  offset: number;
}

export const DEFAULT_LIMIT = 50;

/**
 * Deliberately generous. The dashboard totals a whole history client-side, and
 * a cap that silently returned fewer rows than asked for would quietly under-
 * report someone's spending — the one failure this product cannot have. The
 * cap exists only to stop an absurd range request, not to page the dashboard.
 */
export const MAX_LIMIT = 10000;

export function parseListQuery(params: URLSearchParams): ListQuery {
  const requestedSort = params.get('sort');
  const sort: SortKey = (SORTABLE as readonly string[]).includes(
    requestedSort ?? ''
  )
    ? (requestedSort as SortKey)
    : 'date';

  const type = params.get('type');

  return {
    sort,
    // Newest and largest first is what you want by default; `asc` is opt-in.
    ascending: params.get('dir') === 'asc',
    search: sanitiseSearch(params.get('search')),
    category: params.get('category') || null,
    from: params.get('from') || null,
    to: params.get('to') || null,
    type: type === 'income' || type === 'expense' ? type : null,
    limit: clampInt(params.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: clampInt(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

/**
 * Strips the characters PostgREST reads as filter syntax rather than escaping
 * them: a search box should never be able to rewrite the query it is part of,
 * and nobody searches their spending for a comma. `*` goes too — it is the
 * wildcard, and leaving it in lets one keystroke match everything.
 */
export function sanitiseSearch(raw: string | null): string | null {
  if (!raw) return null;
  const safe = raw.replace(/[,()*\\%]/g, ' ').trim();
  return safe.length > 0 ? safe : null;
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
