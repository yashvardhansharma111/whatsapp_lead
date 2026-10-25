// Platform hosts (edge-safe — no Prisma, used by proxy.ts / middleware)

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "admin", "api", "mail", "smtp", "ftp", "static", "cdn", "assets", "docs",
  "blog", "help", "support", "status", "billing", "dashboard", "login", "auth", "demo", "staging", "dev",
]);

export function normalizeHost(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");
}

export function platformRootDomain(): string | null {
  return normalizeHost(process.env.PLATFORM_ROOT_DOMAIN) || null;
}

export function subdomainOf(host: string | null | undefined): string | null {
  const root = platformRootDomain();
  const h = normalizeHost(host);
  if (!root || !h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export function isPlatformHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  if (!h || h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app")) return true;
  if (subdomainOf(h)) return false;
  const root = platformRootDomain();
  if (root && h.endsWith(`.${root}`)) return true;
  const configured = [process.env.NEXT_PUBLIC_APP_URL, root, ...(process.env.PLATFORM_HOSTS ?? "").split(",")]
    .map(normalizeHost)
    .filter(Boolean);
  return configured.includes(h) || configured.some((c) => h === `www.${c}`);
}

export function isClaimableDomain(domain: string): boolean {
  const d = normalizeHost(domain);
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return false;
  const root = platformRootDomain();
  if (root && (d === root || d.endsWith(`.${root}`))) return false;
  return !isPlatformHost(d);
}

export function isClaimableSubdomain(label: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(label) && label.length >= 3 && !RESERVED_SUBDOMAINS.has(label);
}
