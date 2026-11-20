// The tab icon, per brand.
//
// `app/favicon.ico` was a file, and a file in that position is Next's own convention: it
// is emitted on every page as `<link rel="icon" href="/favicon.ico">`, ahead of anything
// a layout sets in `metadata.icons`. So the uploaded favicon was stored, shown in the
// Brand & icons preview, and never reached a browser tab — the platform's own and every
// white-label reseller's alike showed the Next.js logo.
//
// Served per request instead, from the host, exactly as the manifest is. The file moved
// to /public as the last resort for a brand that has uploaded nothing.
import { NextRequest, NextResponse } from "next/server";
import { getBrandForHost } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const brand = await getBrandForHost(host).catch(() => null);

  const target = brand?.faviconUrl?.trim();
  if (target) {
    // A redirect rather than a proxy: the icon already sits on a CDN, and fetching it
    // through here would put every tab's icon through this server for no gain.
    return NextResponse.redirect(target, {
      status: 307,
      // Short, because a brand that changes its icon should see it soon, and a tab icon
      // is one small request per visit.
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  return NextResponse.redirect(new URL("/favicon-default.ico", req.nextUrl), {
    status: 307,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
