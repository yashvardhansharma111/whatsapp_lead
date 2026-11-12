import type { ReactNode } from "react";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import { getSection } from "@/lib/cms/content";
import { getRequestBrand } from "@/lib/branding";

/**
 * Admin saves expire the CMS cache immediately (see /api/admin/cms/sections/[key]).
 * This interval is only the safety net: a page prerendered while the database was
 * unreachable shows the shipped defaults, and recovers within five minutes.
 */
export const revalidate = 300;

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const [footer, brand] = await Promise.all([getSection("footer"), getRequestBrand()]);
  const mark = { name: brand.name, logoUrl: brand.logoUrl, primaryColor: brand.primaryColor };

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <Navbar brand={mark} />
      <main className="flex-1">{children}</main>
      <Footer section={footer} brand={mark} />
    </div>
  );
}
