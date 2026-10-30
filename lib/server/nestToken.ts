// Server-only: mints the short-lived NestJS service token the proxies use, scoped
// to the business the `current_business` cookie names. Same contract as the
// catch-all proxy's helper, shared by the routes that need it outside it.

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getNestToken(userId: string, email: string, businessId: string | null): Promise<string | null> {
  const cacheKey = `${userId}:${businessId ?? ""}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const secret = process.env.BACKEND_SERVICE_SECRET;
  if (!secret) return null;

  try {
    const res = await fetch(`${BACKEND}/auth/service-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Harmless everywhere, and required when the backend is behind a free ngrok
        // tunnel, which otherwise drops the request or answers with its interstitial
        // page instead of JSON.
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify({ userId, email, secret, businessId }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const { token, expiresIn } = json.data ?? json;
    if (!token) return null;
    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 });
    return token;
  } catch {
    return null;
  }
}

export function backendUrl(): string {
  return BACKEND;
}
