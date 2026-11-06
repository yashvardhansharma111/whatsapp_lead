/**
 * Reads a list response from the gateway, whichever shape it arrives in.
 *
 * The gateway rewrites any `{ things: [...], total, page, limit }` into
 * `{ success, data: [...], pagination: {...} }` before it leaves. That is a reasonable
 * convention, but it means a handler that plainly returns `{ recordings, total, ... }`
 * reaches the browser with no `recordings` key at all — and a page reading `data.recordings`
 * then shows an empty list rather than an error, which looks exactly like having no data.
 *
 * That has now cost two screens, so the shapes are reconciled here instead of in each
 * caller. A failure throws, so React Query reports it as an error rather than as nothing.
 */
export async function readList<T>(
  res: Response,
  key: string,
  fallbackMessage: string,
): Promise<{ items: T[]; total: number }> {
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error ?? json?.message ?? fallbackMessage);
  }

  const payload = json?.data ?? json;

  // Rewritten shape: data is the array itself, counts live under `pagination`.
  if (Array.isArray(payload)) {
    return {
      items: payload as T[],
      total: json?.pagination?.total ?? payload.length,
    };
  }

  // Untouched shape: the handler's own key, with the counts beside it.
  const items = Array.isArray(payload?.[key]) ? (payload[key] as T[]) : [];
  return { items, total: payload?.total ?? json?.pagination?.total ?? items.length };
}
