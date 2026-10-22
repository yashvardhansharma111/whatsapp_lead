// Central client for the NestJS backend.
//
// Browser code:  calls Next.js proxy route  → /api/nest/[...path]
// Server code:   calls NestJS directly      → BACKEND_INTERNAL_URL
//
// Usage:
//   import { backendFetch } from "@/lib/backend";
//   const data = await backendFetch("/contacts?page=1");

const BACKEND_URL =
  typeof window === "undefined"
    ? (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000")
    : "/api/nest"; // browser goes through the Next.js proxy (avoids CORS)

export async function backendFetch(
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, headers: extraHeaders, ...rest } = init;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...rest, headers });
}

// Typed helper — throws on non-2xx
export async function backendGet<T>(path: string, token?: string): Promise<T> {
  const res = await backendFetch(path, { token });
  if (!res.ok) throw new Error(`Backend GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function backendPost<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const res = await backendFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Backend POST ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function backendPatch<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const res = await backendFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Backend PATCH ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function backendDelete<T>(path: string, token?: string): Promise<T> {
  const res = await backendFetch(path, { method: "DELETE", token });
  if (!res.ok) throw new Error(`Backend DELETE ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}
