// ============================================================================
// PAGE : White-label landing page
//
// The public home of a white-label brand, built from that brand's own CMS content.
// The reseller edits the same sections the platform edits for its own site, under its
// own tenant; anything it has not touched falls back to the platform's defaults, so a
// brand that has changed nothing still reads as a finished product.
//
// Pricing is the one section not taken from the CMS: the plans shown have to be the
// plans a visitor is actually charged for, so they come from the reseller's billing
// plans. Contact details come from the brand record for the same reason.
//
// A reseller that switched the landing page off sends visitors straight to its login.
// ============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Globe, Mail, MapPin, Phone } from "lucide-react";
import { headers } from "next/headers";
import { getRequestBrand } from "@/lib/branding";
import { getHomeContent } from "@/lib/cms/content";
import { AiSpotlight } from "@/components/marketing/home/AiSpotlight";
import { Capabilities } from "@/components/marketing/home/Capabilities";
import { DarkBand } from "@/components/marketing/home/DarkBand";
import { Faq } from "@/components/marketing/home/Faq";
import { Hero } from "@/components/marketing/home/Hero";
import { Industries } from "@/components/marketing/home/Industries";
import { Integrations } from "@/components/marketing/home/Integrations";
import { MessageTypes } from "@/components/marketing/home/MessageTypes";
import { Problem } from "@/components/marketing/home/Problem";
import { Stats } from "@/components/marketing/home/Stats";
import { Testimonials } from "@/components/marketing/home/Testimonials";
import { TrustedLogos } from "@/components/marketing/home/TrustedLogos";
import { Workflow } from "@/components/marketing/home/Workflow";
import { Reveal, SectionHeading } from "@/components/marketing/home/primitives";
import { PageCta, Section } from "@/components/marketing/PageShell";

// Branding and plans change; render per request.
export const dynamic = "force-dynamic";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const lim = (n: number) => (n > 0 ? n.toLocaleString("en-IN") : "Unlimited");

export default async function BrandLandingPage() {
  const brand = await getRequestBrand();
  if (!brand.isWhiteLabel) redirect("/login");
  if (!brand.landingEnabled) redirect("/login");

  const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
  const qs = brand.resellerId ? `?resellerId=${encodeURIComponent(brand.resellerId)}` : "";
  const plansRes = await fetch(`${BACKEND}/billing/plans/public${qs}`, { cache: "no-store" }).catch(() => null);
  const plansJson = plansRes?.ok ? await plansRes.json() : null;
  // Only the fields this page draws; the endpoint returns more.
  const plans: {
    id: string; displayName: string; description?: string | null; priceMonthly: number;
    maxContacts: number; maxMsgPerMonth: number; maxAgents: number;
  }[] = plansJson?.data?.plans ?? [];

  // Scoped to this host, so each brand gets its own sections.
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? undefined;
  const home = await getHomeContent(host);

  const hasContact = brand.supportEmail || brand.supportPhone || brand.address || brand.website;

  return (
    <>
      {/* The brand's own content, section for section — the same editor the platform
          uses for its site, scoped to this reseller. */}
      {home.hero.isActive && <Hero section={home.hero} />}
      {home.logos.isActive && <TrustedLogos section={home.logos} />}
      {home.stats.isActive && <Stats section={home.stats} />}
      {home.problem.isActive && <Problem section={home.problem} />}
      {home.howItWorks.isActive && <Workflow section={home.howItWorks} />}
      {home.products.isActive && (
        <DarkBand>
          <Capabilities section={home.products} />
        </DarkBand>
      )}
      {home.ai.isActive && <AiSpotlight section={home.ai} />}
      {home.messageTypes.isActive && <MessageTypes section={home.messageTypes} />}
      {home.integrations.isActive && <Integrations section={home.integrations} />}
      {home.industries.isActive && <Industries section={home.industries} />}
      {home.testimonials.isActive && <Testimonials section={home.testimonials} />}

      {/* ── Pricing ── */}
      {plans.length > 0 && (
        <Section id="pricing" tone="plain">
          <SectionHeading align="center" eyebrow="Pricing" title="Simple plans" description="Start with a free trial. Upgrade when you grow." />
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
            {plans.map((p, i) => (
              <Reveal key={p.id} delay={i * 60}>
                <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
                  <h3 className="font-semibold text-slate-900">{p.displayName}</h3>
                  {p.description && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
                  <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
                    {inr(p.priceMonthly)}<span className="text-sm font-normal text-slate-500">/month</span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                    {[`${lim(p.maxContacts)} contacts`, `${lim(p.maxMsgPerMonth)} messages / month`, `${lim(p.maxAgents)} team members`].map((t) => (
                      <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> {t}</li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    Choose {p.displayName}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ── Contact ── */}
      {hasContact && (
        <Section id="contact" tone="soft">
          <SectionHeading align="center" eyebrow="Contact" title={`Talk to ${brand.name}`} />
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
            {brand.supportEmail && (
              <a href={`mailto:${brand.supportEmail}`} className="inline-flex max-w-full items-center gap-2 break-all rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50">
                <Mail className="h-4 w-4 shrink-0 text-emerald-600" /> {brand.supportEmail}
              </a>
            )}
            {brand.supportPhone && (
              <a href={`tel:${brand.supportPhone.replace(/\s/g, "")}`} className="inline-flex max-w-full items-center gap-2 break-all rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50">
                <Phone className="h-4 w-4 shrink-0 text-emerald-600" /> {brand.supportPhone}
              </a>
            )}
            {brand.website && (
              <a href={brand.website} rel="noopener noreferrer" target="_blank" className="inline-flex max-w-full items-center gap-2 break-all rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50">
                <Globe className="h-4 w-4 shrink-0 text-emerald-600" /> {brand.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {brand.address && (
              <span className="inline-flex max-w-full items-center gap-2 break-words rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-900/5">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" /> {brand.address}
              </span>
            )}
          </div>
        </Section>
      )}

      {home.faq.isActive && <Faq section={home.faq} />}

      <PageCta
        title={`Start with ${brand.name} today`}
        description="Create your account, connect WhatsApp and send your first campaign in minutes."
        primary={{ label: "Get started", href: "/register" }}
        secondary={{ label: "Sign in", href: "/login" }}
      />
    </>
  );
}
