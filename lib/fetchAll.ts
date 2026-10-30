/**
 * Fetches every page of a list endpoint.
 *
 * A paginated API hands back its default page size when asked for nothing, which for a
 * view that groups or filters its rows in the browser — a pipeline board, a status tab, a
 * picker — means the rows beyond that page are not merely on another page, they are
 * invisible, with nothing on screen to say so. Where the view genuinely pages, use the
 * page controls instead; this is for the ones that do not.
 *
 * The request is bounded: a list long enough to hit the ceiling wants real pagination, not
 * a longer loop.
 */

/** The API caps a page at 100, so asking for more just wastes the round trip. */
export const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/** Pulls the rows out of whichever envelope the response arrived in. */
function rowsOf<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  const body = json as { data?: unknown };
  if (Array.isArray(body?.data)) return body.data as T[];
  // Some endpoints keep their named key when the envelope does not apply to them.
  const named = Object.values((body?.data ?? body) as Record<string, unknown>).find(Array.isArray);
  return (named as T[]) ?? [];
}

export async function fetchAllPages<T>(
  path: string,
  init?: { params?: URLSearchParams; pageSize?: number; maxPages?: number },
): Promise<T[]> {
  const size = init?.pageSize ?? PAGE_SIZE;
  const cap = init?.maxPages ?? MAX_PAGES;
  const out: T[] = [];

  for (let page = 1; page <= cap; page++) {
    const params = new URLSearchParams(init?.params);
    params.set("page", String(page));
    params.set("limit", String(size));

    const res = await fetch(`${path}?${params}`);
    if (!res.ok) {
      // Page one failing is a real error; a later page failing still leaves usable rows.
      if (page === 1) throw new Error(`Request failed (${res.status})`);
      break;
    }

    const batch = rowsOf<T>(await res.json());
    out.push(...batch);
    if (batch.length < size) break;
  }

  return out;
}
