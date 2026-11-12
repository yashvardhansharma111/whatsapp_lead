// The sign-in panel's wording when nobody has set any.
//
// Kept apart from lib/branding.ts, which reaches for `headers()` and so cannot be
// imported by a client component. The CMS editor needs these to tell someone what the
// panel is showing while the fields are blank, and a second copy of the strings would
// drift the moment one of them was reworded.

export const BRAND_LOGIN_DEFAULTS = {
  headline: "Turn every WhatsApp chat into a qualified lead.",
  subtext:
    "One workspace for your team to talk to customers, score leads with AI and close faster — all on the channel your customers already use.",
} as const;
