/**
 * What Meta accepts in a message template, as the builder sees it.
 *
 * These limits and checks mirror `libs/common/src/templates` on the server, which is what
 * actually refuses a bad draft. Having them here too means the builder can say what is
 * wrong while it is being typed instead of after a round trip.
 */

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type ParameterFormat = "POSITIONAL" | "NAMED";
export type TemplateType = "STANDARD" | "CAROUSEL";
export type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
export type OtpType = "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";

export type ButtonType =
  | "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "VOICE_CALL" | "OTP" | "FLOW";

export const LIMITS = {
  headerTextChars:   60,
  bodyChars:       1024,
  footerChars:       60,
  buttonTextChars:   25,
  copyCodeChars:     15,
  urlChars:        2000,
  buttonsTotal:      10,
  ltoTextChars:      16,
  carouselCardsMin:   2,
  carouselCardsMax:  10,
  carouselBodyChars: 160,
  carouselButtons:    2,
  codeExpirationMin:  1,
  codeExpirationMax: 90,
} as const;

export const BUTTON_MAX: Record<ButtonType, number> = {
  QUICK_REPLY: 10, URL: 2, PHONE_NUMBER: 1, COPY_CODE: 1, VOICE_CALL: 1, OTP: 1, FLOW: 1,
};

export const CTA_BUTTON_TYPES: ButtonType[] = ["URL", "PHONE_NUMBER", "VOICE_CALL", "COPY_CODE"];
export const CAROUSEL_BUTTON_TYPES: ButtonType[] = ["QUICK_REPLY", "URL", "PHONE_NUMBER"];

export const BUTTON_LABELS: Record<ButtonType, string> = {
  QUICK_REPLY:  "Quick reply",
  URL:          "Visit website",
  PHONE_NUMBER: "Call phone number",
  VOICE_CALL:   "Call on WhatsApp",
  COPY_CODE:    "Copy offer code",
  OTP:          "One-time password",
  FLOW:         "Open a flow",
};

export const HEADER_LABELS: Record<HeaderType, string> = {
  NONE:     "None",
  TEXT:     "Text",
  IMAGE:    "Image",
  VIDEO:    "Video",
  DOCUMENT: "Document",
  LOCATION: "Location",
};

export const MEDIA_HEADERS: HeaderType[] = ["IMAGE", "VIDEO", "DOCUMENT"];

export const FILE_ACCEPT: Record<string, string> = {
  IMAGE:    "image/jpeg,image/png,image/webp",
  VIDEO:    "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// ─── Variables ────────────────────────────────────────────────────────────────

const NAMED_RE = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
const POSITIONAL_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** Named placeholders in order of first appearance. */
export function namedParams(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(NAMED_RE)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

/** The highest `{{n}}`, which is how many values a send has to supply. */
export function positionalCount(text: string): number {
  const nums = [...text.matchAll(POSITIONAL_RE)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

export function paramCount(text: string, format: ParameterFormat): number {
  return format === "NAMED" ? namedParams(text).length : positionalCount(text);
}

/** The label for the nth variable slot, for prompting an example. */
export function paramLabel(text: string, index: number, format: ParameterFormat): string {
  return format === "NAMED" ? `{{${namedParams(text)[index] ?? index + 1}}}` : `{{${index + 1}}}`;
}

/** Whichever format the text already uses, so an edited template keeps working. */
export function detectFormat(text: string): ParameterFormat {
  if (positionalCount(text) > 0) return "POSITIONAL";
  return namedParams(text).length > 0 ? "NAMED" : "POSITIONAL";
}

// ─── Draft ────────────────────────────────────────────────────────────────────

export interface TemplateButtonDraft {
  type: ButtonType;
  text?: string;
  url?: string;
  urlType?: "STATIC" | "DYNAMIC";
  urlExample?: string;
  phone?: string;
  offerCode?: string;
  otpType?: OtpType;
  autofillText?: string;
  packageName?: string;
  signatureHash?: string;
  zeroTapTermsAccepted?: boolean;
  flowId?: string;
  flowAction?: "navigate" | "data_exchange";
  navigateScreen?: string;
}

export interface TemplateCardDraft {
  headerFormat: "IMAGE" | "VIDEO";
  /** Resumable-upload handle, which is what Meta approves the template against. */
  headerHandle?: string | null;
  /** Public URL for the same file, which is what a sent message carries. */
  headerUrl?: string | null;
  body?: string;
  bodyVariables?: string[];
  buttons?: TemplateButtonDraft[];
}

export interface TemplateDraft {
  name: string;
  category: TemplateCategory;
  language: string;
  templateType: TemplateType;
  parameterFormat: ParameterFormat;
  headerType: HeaderType;
  headerContent: string;
  headerVariables: string[];
  body: string;
  variables: string[];
  footer: string;
  buttons: TemplateButtonDraft[];
  cards: TemplateCardDraft[];
  ltoText: string;
  ltoHasExpiration: boolean;
  addSecurityRecommendation: boolean;
  codeExpirationMinutes: number | null;
  messageSendTtlSeconds: number | null;
}

export function emptyCard(headerFormat: "IMAGE" | "VIDEO" = "IMAGE"): TemplateCardDraft {
  return { headerFormat, headerHandle: null, headerUrl: null, body: "", bodyVariables: [], buttons: [] };
}

// ─── Text checks ──────────────────────────────────────────────────────────────

const HIDDEN_CHARS = [0x00a0, 0x200b, 0x200c, 0x200d, 0x00ad, 0xfeff, 0x2028, 0x2029];

/**
 * The body problems Meta rejects after submission, caught while typing. Each one here has
 * cost a real rejection at some point, which is why the list is this specific.
 */
export function bodyProblem(body: string, format: ParameterFormat): string | null {
  if (!body.trim()) return null;
  if (body.length > LIMITS.bodyChars) return `Body is ${body.length} characters. The limit is ${LIMITS.bodyChars}.`;
  if (/\*\*[^*\n]+\*\*/.test(body)) return "Use single *asterisks* for bold. WhatsApp rejects the double-asterisk form.";
  if (/(?<![_])__[^_\n]+__/.test(body)) return "Use single _underscores_ for italic, not double.";
  if (/\s$/.test(body)) return "Remove the trailing space or newline. Meta rejects a body that ends in whitespace.";
  if (/^\s*\{\{/.test(body)) return "A body cannot open with a variable. Put at least one character before it.";
  if (/\}\}\s*$/.test(body)) return "A body cannot end with a variable. Put at least one character after it.";
  if ([...body].some((c, i) => c === "*" && [0x2014, 0x2013, 0x2022].includes(body.charCodeAt(i + 1)))) {
    return "A bold span opens with punctuation. Write — *text* rather than *— text*.";
  }
  if ([...body].some((c) => HIDDEN_CHARS.includes(c.charCodeAt(0)))) {
    return "The body holds hidden characters, usually from a word processor. Retype it or paste through a plain text editor first.";
  }
  if (/\n{4,}/.test(body)) return "More than two blank lines in a row. Meta rejects that.";
  if (/\t/.test(body)) return "Replace tab characters with spaces.";

  if (format === "POSITIONAL") {
    const used = [...new Set([...body.matchAll(POSITIONAL_RE)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    if (used.length && used[0] !== 1) return `Numbered variables start at {{1}}, but the first one here is {{${used[0]}}}.`;
    for (let i = 1; i < used.length; i++) {
      if (used[i] !== used[i - 1] + 1) return `Numbered variables run in order. {{${used[i - 1]}}} jumps to {{${used[i]}}}.`;
    }
  }
  return null;
}

export function headerProblem(headerType: HeaderType, content: string, format: ParameterFormat): string | null {
  if (headerType !== "TEXT" || !content.trim()) return null;
  if (content.length > LIMITS.headerTextChars) return `Header is ${content.length} characters. The limit is ${LIMITS.headerTextChars}.`;
  if (/[*_~`]/.test(content)) return "Headers are plain text. Bold, italic and strikethrough are not allowed.";
  if (paramCount(content, format) > 1) return "A header holds one variable at most.";
  return null;
}

export function exampleProblem(value: string): string | null {
  if (!value.trim()) return null;
  if (/^https?:\/\//i.test(value.trim())) return "An example cannot be a URL. Use a short text value.";
  if (/[#$%]/.test(value)) return "An example cannot contain #, $ or %.";
  return null;
}

export function buttonProblem(b: TemplateButtonDraft): string | null {
  if (b.type !== "COPY_CODE" && b.type !== "OTP" && !b.text?.trim()) return "This button needs a label.";
  if ((b.text?.length ?? 0) > LIMITS.buttonTextChars) return `A label is ${LIMITS.buttonTextChars} characters at most.`;

  if (b.type === "URL") {
    const url = b.url?.trim() ?? "";
    if (!url) return "This button needs a URL.";
    if (!/^https:\/\//i.test(url)) return "The URL must start with https://.";
    if (url.length > LIMITS.urlChars) return `The URL is ${LIMITS.urlChars} characters at most.`;
    try { new URL(url.replace(/\{\{[^}]+\}\}/g, "placeholder")); }
    catch { return "That is not a valid URL."; }
    if (/\{\{[^}]+\}\}/.test(url) && !b.urlExample?.trim()) return "Give an example for the URL's variable.";
  }

  if (b.type === "PHONE_NUMBER" || b.type === "VOICE_CALL") {
    const phone = b.phone?.trim() ?? "";
    if (!phone) return "This button needs a phone number.";
    if (!/^\+\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ""))) return "Start with + and the country code, like +919876543210.";
  }

  if (b.type === "COPY_CODE") {
    if (!b.offerCode?.trim()) return "This button needs an example code.";
    if (b.offerCode.length > LIMITS.copyCodeChars) return `A code is ${LIMITS.copyCodeChars} characters at most.`;
  }

  if (b.type === "OTP" && b.otpType && b.otpType !== "COPY_CODE") {
    if (!b.packageName?.trim() || !b.signatureHash?.trim()) return "One-tap and zero-tap need your app package name and signature hash.";
  }

  return null;
}

/** Which button types can still be added, given the ones already there. */
export function availableButtonTypes(
  draft: Pick<TemplateDraft, "category" | "buttons">,
  excludeIndex?: number,
): ButtonType[] {
  const others = excludeIndex === undefined
    ? draft.buttons
    : draft.buttons.filter((_, i) => i !== excludeIndex);

  if (draft.category === "AUTHENTICATION") {
    return others.some((b) => b.type === "OTP") ? [] : ["OTP"];
  }

  const hasQuickReply = others.some((b) => b.type === "QUICK_REPLY");
  const hasCta = others.some((b) => CTA_BUTTON_TYPES.includes(b.type));

  return (Object.keys(BUTTON_MAX) as ButtonType[]).filter((type) => {
    if (type === "OTP") return false;
    if (type === "QUICK_REPLY" && hasCta) return false;
    if (CTA_BUTTON_TYPES.includes(type) && hasQuickReply) return false;
    return others.filter((b) => b.type === type).length < BUTTON_MAX[type];
  });
}

/** Two cards are built the same way when their media, text and buttons line up. */
export function cardShape(card: TemplateCardDraft): string {
  return [
    card.headerFormat,
    card.body?.trim() ? "body" : "no-body",
    (card.buttons ?? []).map((b) => b.type).join("+") || "no-buttons",
  ].join(" · ");
}

/**
 * Everything wrong with the draft, in the order a person would fix it. Empty means it is
 * ready to save and submit.
 */
export function draftProblems(draft: TemplateDraft): string[] {
  const problems: string[] = [];
  const format = draft.parameterFormat;

  if (!draft.name.trim()) problems.push("Give the template a name.");
  else if (!/^[a-z0-9_]+$/.test(draft.name)) problems.push("A name uses lowercase letters, numbers and underscores only.");

  if (draft.category === "AUTHENTICATION") {
    const minutes = draft.codeExpirationMinutes;
    if (minutes != null && (minutes < LIMITS.codeExpirationMin || minutes > LIMITS.codeExpirationMax)) {
      problems.push(`Code expiry runs from ${LIMITS.codeExpirationMin} to ${LIMITS.codeExpirationMax} minutes.`);
    }
    const otp = draft.buttons.find((b) => b.type === "OTP");
    if (otp) {
      const problem = buttonProblem(otp);
      if (problem) problems.push(problem);
    }
    return problems;
  }

  if (!draft.body.trim()) problems.push("Write the message body.");
  const body = bodyProblem(draft.body, format);
  if (body) problems.push(body);

  const bodyVars = paramCount(draft.body, format);
  const filled = draft.variables.filter((v) => v?.trim()).length;
  if (bodyVars > filled) problems.push(`Give an example for each of the body's ${bodyVars} variables.`);
  draft.variables.slice(0, bodyVars).forEach((v, i) => {
    const problem = exampleProblem(v ?? "");
    if (problem) problems.push(`Example ${i + 1}: ${problem}`);
  });

  if (draft.templateType === "CAROUSEL") {
    if (draft.cards.length < LIMITS.carouselCardsMin || draft.cards.length > LIMITS.carouselCardsMax) {
      problems.push(`A carousel holds ${LIMITS.carouselCardsMin} to ${LIMITS.carouselCardsMax} cards. It has ${draft.cards.length}.`);
    }
    const shapes = new Set(draft.cards.map(cardShape));
    if (shapes.size > 1) {
      problems.push("Every card has to be built the same way: same media type, the same buttons, and text on all of them or none.");
    }
    draft.cards.forEach((card, i) => {
      const label = `Card ${i + 1}`;
      if (!card.headerHandle?.trim()) problems.push(`${label}: upload its ${card.headerFormat.toLowerCase()}.`);
      else if (!card.headerUrl?.trim()) problems.push(`${label}: add a public media URL so the card can be sent.`);
      if ((card.body?.length ?? 0) > LIMITS.carouselBodyChars) {
        problems.push(`${label}: text is ${card.body!.length} characters, and the limit is ${LIMITS.carouselBodyChars}.`);
      }
      const cardVars = paramCount(card.body ?? "", format);
      if (cardVars > (card.bodyVariables ?? []).filter((v) => v?.trim()).length) {
        problems.push(`${label}: give an example for each of its variables.`);
      }
      (card.buttons ?? []).forEach((b) => {
        const problem = buttonProblem(b);
        if (problem) problems.push(`${label}: ${problem}`);
      });
    });
  } else {
    const header = headerProblem(draft.headerType, draft.headerContent, format);
    if (header) problems.push(header);
    if (MEDIA_HEADERS.includes(draft.headerType) && !draft.headerContent.trim()) {
      problems.push(`Add the ${draft.headerType.toLowerCase()} for the header.`);
    }
    if (draft.headerType === "TEXT" && paramCount(draft.headerContent, format) > 0
        && !draft.headerVariables[0]?.trim()) {
      problems.push("Give an example for the header's variable.");
    }
    if (draft.footer.length > LIMITS.footerChars) {
      problems.push(`Footer is ${draft.footer.length} characters, and the limit is ${LIMITS.footerChars}.`);
    }
  }

  draft.buttons.forEach((b, i) => {
    const problem = buttonProblem(b);
    if (problem) problems.push(`Button ${i + 1}: ${problem}`);
  });
  if (draft.buttons.length > LIMITS.buttonsTotal) {
    problems.push(`A template carries ${LIMITS.buttonsTotal} buttons at most.`);
  }
  // The add menu already caps each type, but an imported template can arrive over it.
  const counts = new Map<ButtonType, number>();
  for (const b of draft.buttons) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
  for (const [type, used] of counts) {
    if (used > BUTTON_MAX[type]) {
      problems.push(`Only ${BUTTON_MAX[type]} ${BUTTON_LABELS[type].toLowerCase()} button${BUTTON_MAX[type] > 1 ? "s" : ""} allowed.`);
    }
  }
  if (draft.buttons.some((b) => b.type === "QUICK_REPLY") && draft.buttons.some((b) => CTA_BUTTON_TYPES.includes(b.type))) {
    problems.push("Quick replies cannot sit alongside website, call or copy-code buttons.");
  }

  if (draft.ltoText.trim()) {
    if (draft.category !== "MARKETING") problems.push("A limited-time offer only works on a marketing template.");
    if (!draft.buttons.some((b) => b.type === "COPY_CODE")) problems.push("A limited-time offer needs a copy-code button.");
    if (!draft.buttons.some((b) => b.type === "URL")) problems.push("A limited-time offer needs a website button.");
  }

  return problems;
}
