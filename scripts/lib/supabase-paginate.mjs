/** PostgREST default max rows per response (Supabase). */
export const SUPABASE_PAGE_SIZE = 1000;

/** Fetch every row from a query that may exceed SUPABASE_PAGE_SIZE. */
export async function fetchAllPages(queryPage) {
  const all = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return all;
}

/** All rows from a table with optional stable ordering for pagination. */
export async function fetchAllTableRows(supabase, table, select, orderColumn) {
  return fetchAllPages((from, to) => {
    let query = supabase.from(table).select(select).range(from, to);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }
    return query;
  });
}
