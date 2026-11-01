"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { AiSpotlight } from "@/components/marketing/home/AiSpotlight";
import { Capabilities } from "@/components/marketing/home/Capabilities";
import { Faq } from "@/components/marketing/home/Faq";
import { FinalCta } from "@/components/marketing/home/FinalCta";
import { Hero } from "@/components/marketing/home/Hero";
import { Industries } from "@/components/marketing/home/Industries";
import { Integrations } from "@/components/marketing/home/Integrations";
import { MessageTypes } from "@/components/marketing/home/MessageTypes";
import { Newsletter } from "@/components/marketing/home/Newsletter";
import { Pricing } from "@/components/marketing/home/Pricing";
import { Problem } from "@/components/marketing/home/Problem";
import { Stats } from "@/components/marketing/home/Stats";
import { Testimonials } from "@/components/marketing/home/Testimonials";
import { TrustedLogos } from "@/components/marketing/home/TrustedLogos";
import { Workflow } from "@/components/marketing/home/Workflow";
import { CMS_SECTIONS, type SectionKey } from "@/lib/cms/sections";
import { toPublicSection, type StoredSection } from "@/lib/cms/store";

/* eslint-disable @typescript-eslint/no-explicit-any -- one map over sixteen differently
   typed sections; each component is given the section it declares, keyed by the same
   literal, and narrowing that relationship costs more than it protects here. */
const RENDERERS: Partial<Record<SectionKey, (p: any) => React.ReactNode>> = {
  hero:         Hero,
  logos:        TrustedLogos,
  stats:        Stats,
  problem:      Problem,
  howItWorks:   Workflow,
  products:     Capabilities,
  ai:           AiSpotlight,
  messageTypes: MessageTypes,
  integrations: Integrations,
  industries:   Industries,
  testimonials: Testimonials,
  pricing:      Pricing,
  faq:          Faq,
  cta:          FinalCta,
  newsletter:   Newsletter,
};

/**
 * The section as the site would draw it, from the edits currently on screen.
 *
 * Preview used to open the live home page in another tab, which showed the last *saved*
 * state and made the reader find the section themselves. This renders the real component
 * with the draft, so what is being typed is what is shown — and a dialog keeps the work
 * in place behind it rather than navigating away from it.
 */
export function SectionPreview({
  sectionKey,
  stored,
  onClose,
}: {
  sectionKey: SectionKey;
  /** The draft, in the shape a saved row would have. */
  stored: StoredSection;
  onClose: () => void;
}) {
  const section = useMemo(() => toPublicSection(sectionKey, stored), [sectionKey, stored]);
  const Renderer = RENDERERS[sectionKey];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${CMS_SECTIONS[sectionKey].label} preview`}
      className="fixed inset-0 z-[80] flex flex-col bg-slate-900/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {CMS_SECTIONS[sectionKey].label}
            </p>
            <p className="text-xs text-slate-500">As the page would show it, including unsaved edits.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The site's own background, so spacing and contrast read as they will live. */}
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto bg-white">
          {Renderer ? (
            <Renderer section={section} />
          ) : (
            <p className="px-6 py-16 text-center text-sm text-slate-500">
              This section is part of the page frame rather than its body, so there is
              nothing to draw on its own.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
