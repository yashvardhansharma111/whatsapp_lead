// The home-screen icon, per brand.
//
// The field has been on both branding screens from the start and nothing ever served it,
// so a brand saved to an iPhone home screen got whatever the browser chose to scrape.
// Falls back to the favicon, which is at least the right brand, before the platform's
// own default.
import { NextRequest, NextResponse } from "next/server";
import { getBrandForHost } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const brand = await getBrandForHost(host).catch(() => null);

  const target = brand?.appleIconUrl?.trim() || brand?.faviconUrl?.trim();
  if (target) {
    return NextResponse.redirect(target, {
      status: 307,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  return NextResponse.redirect(new URL("/favicon-default.ico", req.nextUrl), {
    status: 307,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
