import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools bubble is pinned bottom-left, directly on top of the sidebar's
  // user/plan footer, which makes the shell look broken while you are reviewing it.
  devIndicators: false,
  // `npm run dev` only serves its scripts to localhost. White-label reseller sites are
  // tried locally at <subdomain>.lvh.me:3000 (lvh.me resolves to 127.0.0.1); without
  // this their pages load with no JavaScript. Development only — ignored in production.
  allowedDevOrigins: ["lvh.me", "*.lvh.me"],
  // Native Node.js packages that Turbopack must not bundle — use require() at runtime.
  serverExternalPackages: ["exceljs"],
  // A build and the dev server both write here, and a build run while dev is up
  // replaces the chunks the open browser is still asking for — which it reports as a
  // ChunkLoadError that looks like broken code rather than a clobbered directory.
  // `npm run build:check` sets this so a correctness build can run alongside dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
