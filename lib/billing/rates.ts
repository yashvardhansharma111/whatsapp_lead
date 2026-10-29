// Message pricing — shared client vocabulary. Mirrors
// backend/libs/common/src/rates/message-rates.service.ts.

export type RateCategory = "WA_MARKETING" | "WA_UTILITY" | "WA_AUTHENTICATION";

export const RATE_CATEGORIES: RateCategory[] = ["WA_MARKETING", "WA_UTILITY", "WA_AUTHENTICATION"];

/** Where an effective price came from. `unpriced` means nothing is set anywhere — free. */
export type RateSource = "customer" | "reseller" | "platform" | "unpriced";

export interface ResolvedRate {
  category: RateCategory | string;
  priceMinor: number;
  source: RateSource;
  customerMinor: number | null;
  resellerMinor: number | null;
  platformMinor: number | null;
}

export const RATE_LABEL: Record<string, string> = {
  WA_MARKETING: "Marketing",
  WA_UTILITY: "Utility",
  WA_AUTHENTICATION: "Authentication",
};

export const RATE_LONG_LABEL: Record<string, string> = {
  WA_MARKETING: "WhatsApp — marketing template",
  WA_UTILITY: "WhatsApp — utility template",
  WA_AUTHENTICATION: "WhatsApp — authentication template",
};

export const RATE_HINT: Record<string, string> = {
  WA_MARKETING: "Promotional campaigns, offers and announcements",
  WA_UTILITY: "Transactional messages, order updates, alerts",
  WA_AUTHENTICATION: "OTPs and account verification messages",
};

export const SOURCE_LABEL: Record<RateSource, string> = {
  customer: "Custom price",
  reseller: "Reseller price",
  platform: "Platform price",
  unpriced: "Free",
};

/** Tailwind ring/bg/text classes per source, for the badge next to a price. */
export const SOURCE_TONE: Record<RateSource, string> = {
  customer: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  reseller: "bg-sky-50 text-sky-700 ring-sky-600/20",
  platform: "bg-slate-100 text-slate-600 ring-slate-500/20",
  unpriced: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

/** Paise → "₹0.75". A null price means the category is not charged at all. */
export function paise(priceMinor: number | null | undefined): string {
  if (priceMinor == null) return "Free";
  return `₹${(priceMinor / 100).toFixed(2)}`;
}

/** The price a customer falls back to when its own override is removed. */
export function inheritedMinor(rate: ResolvedRate): number | null {
  return rate.resellerMinor ?? rate.platformMinor ?? null;
}
