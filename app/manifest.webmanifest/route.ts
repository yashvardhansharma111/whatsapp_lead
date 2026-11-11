// The installed-app identity, per brand.
//
// This was a static file in /public, so every white-label reseller's customers installed
// an app called "Waboxa" with Waboxa's icons and Waboxa's colour — on the one surface a
// white label most needs to be its own, the phone's home screen.
//
// Served per request instead, from the host. The platform's own values are the fallback,
// so nothing changes for it.
import { NextRequest, NextResponse } from "next/server";
import { getBrandForHost } from "@/lib/branding";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const brand = await getBrandForHost(host).catch(() => null);

  const name = brand?.name ?? "Waboxa";
  const theme = brand?.themeColor || brand?.primaryColor || "#0B6E4F";

  // A brand that has uploaded icons gets them at both sizes; browsers scale, and one
  // correct image beats two wrong ones. Without any, the platform's own are used.
  const icons = brand?.faviconUrl
    ? [
        { src: brand.appleIconUrl ?? brand.faviconUrl, sizes: "192x192", type: "image/png" },
        { src: brand.appleIconUrl ?? brand.faviconUrl, sizes: "512x512", type: "image/png" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ];

  return NextResponse.json(
    {
      name,
      short_name: name.length > 12 ? name.slice(0, 12) : name,
      start_url: "/inbox",
      display: "standalone",
      background_color: "#f6f7f9",
      theme_color: theme,
      icons,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        // Short, because a brand that changes its icon should see it soon, and this is
        // one small document per host.
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
