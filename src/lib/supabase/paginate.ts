/**
 * Pagination helper for Supabase / PostgREST queries.
 *
 * PostgREST has a default max-rows limit (1000). Any `.select()` without an
 * explicit `.range()` is silently truncated to that limit, which has bitten
 * us when summing transactions for the accumulated balance — once we crossed
 * 1000 rows, the displayed Saldo Acumulado started drifting by the value of
 * the rows that were silently dropped.
 *
 * Use `fetchAllPages` whenever the result set can grow beyond ~1000 rows
 * (e.g. anything that scans more than a single month of `transactions`).
 *
 * Usage:
 *
 *   const rows = await fetchAllPages<{ amount: number; type: string }>(
 *     (from, to) => supabase
 *       .from("transactions")
 *       .select("amount, type")
 *       .lte("date", endDate)
 *       .range(from, to)
 *   );
 */
const DEFAULT_PAGE_SIZE = 1000;

interface PageResult<T> {
    data: T[] | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any;
}

export async function fetchAllPages<T>(
    build: (from: number, to: number) => PromiseLike<PageResult<T>>,
    pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
    const all: T[] = [];

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await build(from, from + pageSize - 1);

        if (error) {
            throw error;
        }
        if (!data || data.length === 0) break;

        all.push(...data);

        // If the page is short, we've reached the end
        if (data.length < pageSize) break;

        // Safety: prevent runaway loops on misconfigured queries
        if (all.length > 1_000_000) {
            throw new Error(
                "fetchAllPages: aborted after fetching >1M rows — refine the filter",
            );
        }
    }

    return all;
}
