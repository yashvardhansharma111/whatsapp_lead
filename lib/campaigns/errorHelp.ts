/**
 * Where to go to fix the errors that stop a whole campaign.
 *
 * The server already says what went wrong in a sentence. What it cannot say is which of
 * these is yours to fix and where — and for the ones that stop everything, that is the
 * only thing worth knowing. A billing failure in particular reads like a fault in this
 * app when it is a payment method on the business's own Meta account, and someone can
 * lose an afternoon to that.
 *
 * Only account-level and template-level stoppages are listed. Per-recipient failures —
 * a number not on WhatsApp, a closed 24-hour window — are normal, and sending someone
 * to a settings page over one would be wrong.
 */
export interface ErrorHelp {
  /** Who owns this problem, in a few words. */
  owner: "meta" | "workspace";
  /** The one thing to do about it. */
  action: string;
  href?: string;
  hrefLabel?: string;
  /** External links open a new tab; internal ones route in place. */
  external?: boolean;
}

const META_BILLING = "https://business.facebook.com/billing_hub/payment_settings";
const WA_MANAGER   = "https://business.facebook.com/wa/manage/home/";

export const ERROR_HELP: Record<number, ErrorHelp> = {
  // Billing — the payment method on the Meta business account, not anything here.
  131042: {
    owner: "meta",
    action:
      "This is the payment method on your Meta business account, not your balance here. " +
      "Marketing and utility templates are charged by Meta on every message, so none will " +
      "send until Meta can bill the account.",
    href: META_BILLING,
    hrefLabel: "Open Meta payment settings",
    external: true,
  },

  // Token — ours to fix, in Settings.
  0:   { owner: "workspace", action: "Reconnect the WhatsApp number so a fresh token is stored.", href: "/settings?tab=whatsapp", hrefLabel: "Go to WhatsApp settings" },
  190: { owner: "workspace", action: "The access token has expired. Reconnect the number to store a new one.", href: "/settings?tab=whatsapp", hrefLabel: "Go to WhatsApp settings" },

  // Permissions on the connected Meta app.
  3:  { owner: "meta", action: "The connected app is missing a permission it needs to send.", href: WA_MANAGER, hrefLabel: "Open WhatsApp Manager", external: true },
  10: { owner: "meta", action: "Permission to send was removed from the connected app.", href: WA_MANAGER, hrefLabel: "Open WhatsApp Manager", external: true },

  // The account itself is restricted.
  368:    { owner: "meta", action: "WhatsApp has blocked the account temporarily. Check the account status before sending again.", href: WA_MANAGER, hrefLabel: "Open WhatsApp Manager", external: true },
  131031: { owner: "meta", action: "WhatsApp has restricted this account. Its status in WhatsApp Manager explains why.", href: WA_MANAGER, hrefLabel: "Open WhatsApp Manager", external: true },
  131048: {
    owner: "meta",
    action:
      "Too many people blocked or reported messages from this number, so WhatsApp is holding it back. " +
      "Sending more makes it worse — let the quality rating recover first.",
    href: WA_MANAGER,
    hrefLabel: "Check quality rating",
    external: true,
  },

  // The number is not usable for sending.
  33:     { owner: "workspace", action: "This number no longer exists on WhatsApp. Connect a working one.", href: "/settings?tab=whatsapp", hrefLabel: "Go to WhatsApp settings" },
  131045: { owner: "workspace", action: "This number is not registered with WhatsApp. Finish connecting it.", href: "/settings?tab=whatsapp", hrefLabel: "Go to WhatsApp settings" },
  133010: { owner: "workspace", action: "This number is not registered on the WhatsApp platform.", href: "/settings?tab=whatsapp", hrefLabel: "Go to WhatsApp settings" },

  // The template cannot be sent as it stands.
  132001: { owner: "workspace", action: "That template is not approved in this language. Pick another, or import the latest from Meta.", href: "/templates", hrefLabel: "Go to templates" },
  132015: { owner: "workspace", action: "WhatsApp paused this template for low quality. Edit it and submit it again.", href: "/templates", hrefLabel: "Go to templates" },
  132016: { owner: "workspace", action: "WhatsApp disabled this template for good. Build a new one.", href: "/templates", hrefLabel: "Go to templates" },
  132007: { owner: "workspace", action: "The template's content breaks WhatsApp's policy and has to change.", href: "/templates", hrefLabel: "Go to templates" },
  131052: { owner: "workspace", action: "WhatsApp could not download the media in this template. Re-upload it.", href: "/templates", hrefLabel: "Go to templates" },
  131053: { owner: "workspace", action: "WhatsApp rejected this template's media. Check the file type and size.", href: "/templates", hrefLabel: "Go to templates" },
};

export function errorHelp(code: number | null | undefined): ErrorHelp | null {
  return code == null ? null : ERROR_HELP[code] ?? null;
}
