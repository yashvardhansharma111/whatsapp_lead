import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Check, Mail, MessageSquare, Phone } from "lucide-react";
import { brandMetadata, brandStyle, getRequestBrand } from "@/lib/branding";
import { getSection } from "@/lib/cms/content";

/**
 * Login and sign-up take the brand of the domain they're served on: a white-label
 * reseller's domain shows its name, logo, colours, headline and contact details,
 * with no trace of the platform.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getRequestBrand();
  return {
    title: brand.isWhiteLabel ? brand.name : `${brand.name} — AI-Powered WhatsApp CRM & Lead Management`,
    description: brand.loginSubtext,
    ...brandMetadata(brand),
  };
}

function BrandMark({ logoUrl, className }: { logoUrl: string | null; className: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a reseller's logo on its own host
    return <img src={logoUrl} alt="" className={`${className} object-contain`} />;
  }
  return (
    <span className={`${className} flex items-center justify-center`}>
      <MessageSquare className="h-1/2 w-1/2 text-white" />
    </span>
  );
}

/** The initials shown when a testimonial has no photo. */
function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "—";
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const brand = await getRequestBrand();
  const year = new Date().getFullYear();

  // The panel's wording lives in the CMS. Headline and subtext fall back to the brand's
  // when left empty, so a white-label reseller that edits nothing still gets its own.
  // Scoped to the host, so a reseller's domain gets that brand's own panel.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? undefined;
  const panel = await getSection("login", host).catch(() => null);
  const headline = String(panel?.content.headline ?? "").trim() || brand.loginHeadline;
  const subtext  = String(panel?.content.subtext ?? "").trim() || brand.loginSubtext;
  const features = (panel?.items.loginFeature ?? [])
    .map((f) => String(f.label ?? "").trim())
    .filter(Boolean);
  const quote = String(panel?.content.quote ?? "").trim().replace(/\{brand\}/g, brand.name);
  const quoteName = String(panel?.content.quoteName ?? "").trim();
  const quoteRole = String(panel?.content.quoteRole ?? "").trim();
  const quoteAvatar = String(panel?.content.quoteAvatarUrl ?? "").trim();

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2" style={brandStyle(brand)}>
      {/* ─── Left branding panel ─────────────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-12 text-white lg:flex">
        {/* Decorative blurred circles */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-1/4 top-1/3 h-52 w-52 rounded-full bg-emerald-200/10 blur-2xl"
        />

        {/* Logo */}
        <Link
          href="/"
          className="relative z-10 inline-flex w-fit items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <BrandMark
            logoUrl={brand.logoUrl}
            className="h-10 w-10 rounded-xl bg-white/15 ring-1 ring-inset ring-white/25 backdrop-blur-sm"
          />
          <span className="text-xl font-bold tracking-tight">{brand.name}</span>
        </Link>

        {/* Headline + features */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">{headline}</h2>
          <p className="mt-4 text-base leading-relaxed text-emerald-50/90">{subtext}</p>

          <ul className="mt-8 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/20">
                  <Check className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-sm font-medium text-emerald-50">{feature}</span>
              </li>
            ))}
          </ul>

          {/* White-label: the reseller's contact details. Platform: the testimonial. */}
          {brand.isWhiteLabel ? (
            (brand.supportEmail || brand.supportPhone || brand.address) && (
              <div className="mt-10 space-y-2 rounded-2xl bg-white/10 p-6 text-sm ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                {brand.supportEmail && (
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /> {brand.supportEmail}</p>
                )}
                {brand.supportPhone && (
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> {brand.supportPhone}</p>
                )}
                {brand.address && <p className="text-emerald-50/80">{brand.address}</p>}
              </div>
            )
          ) : (
          quote ? (
          <figure className="mt-10 rounded-2xl bg-white/10 p-6 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
            <blockquote className="text-sm leading-relaxed text-white">&ldquo;{quote}&rdquo;</blockquote>
            {quoteName && (
              <figcaption className="mt-4 flex items-center gap-3">
                {quoteAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- an arbitrary URL the admin set
                  <img src={quoteAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                    {initialsOf(quoteName)}
                  </span>
                )}
                <span className="text-xs leading-tight">
                  <span className="block font-semibold text-white">{quoteName}</span>
                  {quoteRole && <span className="block text-emerald-100/80">{quoteRole}</span>}
                </span>
              </figcaption>
            )}
          </figure>
          ) : null
          )}
        </div>

        <p className="relative z-10 text-xs text-emerald-100/70">
          © {year} {brand.legalName}
        </p>
      </div>

      {/* ─── Right form panel ────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col lg:min-h-0">
        {/* Mobile logo */}
        <div className="flex items-center justify-center px-6 pt-10 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandMark logoUrl={brand.logoUrl} className="h-9 w-9 rounded-xl bg-emerald-600" />
            <span className="text-lg font-bold tracking-tight text-slate-900">{brand.name}</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-8 lg:py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <p className="px-6 pb-8 text-center text-xs text-slate-400 lg:hidden">
          © {year} {brand.legalName}
        </p>
      </div>
    </div>
  );
}
