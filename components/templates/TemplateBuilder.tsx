"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Images, Info, LayoutTemplate, Timer } from "lucide-react";
import { Button, Field, Modal, inputClass } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { ButtonsEditor } from "@/components/templates/ButtonsEditor";
import { CarouselEditor } from "@/components/templates/CarouselEditor";
import { MediaPicker } from "@/components/templates/MediaPicker";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { NumberPicker } from "@/components/NumberPicker";
import { useWhatsAppNumbers } from "@/hooks/useWhatsAppNumbers";
import {
  HEADER_LABELS, LIMITS, MEDIA_HEADERS,
  bodyProblem, detectFormat, draftProblems, emptyCard, headerProblem, paramCount, paramLabel,
  type HeaderType, type ParameterFormat, type TemplateCategory, type TemplateDraft, type TemplateType,
} from "@/lib/templates/spec";
import {
  useCreateTemplate, useUpdateTemplate,
  type TemplateDTO, type TemplateInput,
} from "@/hooks/useTemplates";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: TemplateCategory; label: string; hint: string }[] = [
  { value: "MARKETING",      label: "Marketing",      hint: "Offers, product news, anything promotional." },
  { value: "UTILITY",        label: "Utility",        hint: "About an order or account the customer already has." },
  { value: "AUTHENTICATION", label: "Authentication", hint: "One-time passcodes. Meta writes the wording." },
];

const LANGUAGES = [
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "en",    label: "English" },
  { code: "hi_IN", label: "Hindi" },
  { code: "mr_IN", label: "Marathi" },
  { code: "gu_IN", label: "Gujarati" },
  { code: "ta_IN", label: "Tamil" },
  { code: "te_IN", label: "Telugu" },
  { code: "bn_IN", label: "Bengali" },
  { code: "ar_AR", label: "Arabic" },
  { code: "es_ES", label: "Spanish" },
  { code: "pt_BR", label: "Portuguese (Brazil)" },
  { code: "fr",    label: "French" },
  { code: "de",    label: "German" },
  { code: "id",    label: "Indonesian" },
];

const LAYOUTS: { value: TemplateType; icon: typeof LayoutTemplate; label: string; hint: string }[] = [
  { value: "STANDARD", icon: LayoutTemplate, label: "Single message", hint: "A header, text, footer and buttons." },
  { value: "CAROUSEL", icon: Images,         label: "Carousel",       hint: `Text plus ${LIMITS.carouselCardsMin}–${LIMITS.carouselCardsMax} swipeable cards.` },
];

/** A non-Latin language whose script is missing from the body is almost always a mistake. */
const SCRIPTS: Record<string, { label: string; pattern: RegExp }> = {
  hi_IN: { label: "Hindi",    pattern: /[ऀ-ॿ]/ },
  mr_IN: { label: "Marathi",  pattern: /[ऀ-ॿ]/ },
  gu_IN: { label: "Gujarati", pattern: /[઀-૿]/ },
  ta_IN: { label: "Tamil",    pattern: /[஀-௿]/ },
  te_IN: { label: "Telugu",   pattern: /[ఀ-౿]/ },
  bn_IN: { label: "Bengali",  pattern: /[ঀ-৿]/ },
  ar_AR: { label: "Arabic",   pattern: /[؀-ۿ]/ },
};

function initialDraft(editing: TemplateDTO | null): TemplateDraft {
  const body = editing?.body ?? "";
  // A media header stored as anything but an upload handle is a hand-typed sample URL.
  return {
    name:            editing?.name ?? "",
    category:        (editing?.category as TemplateCategory) ?? "MARKETING",
    language:        editing?.language ?? "en_US",
    templateType:    (editing?.templateType as TemplateType) ?? "STANDARD",
    parameterFormat: (editing?.parameterFormat as ParameterFormat) ?? detectFormat(body),
    headerType:      (editing?.headerType as HeaderType) ?? "NONE",
    headerContent:   editing?.headerContent ?? "",
    headerVariables: editing?.headerVariables ?? [],
    body,
    variables:       editing?.variables ?? [],
    footer:          editing?.footer ?? "",
    buttons:         editing?.buttons ?? [],
    cards:           editing?.cards ?? [],
    ltoText:         editing?.ltoText ?? "",
    ltoHasExpiration: editing?.ltoHasExpiration ?? false,
    addSecurityRecommendation: editing?.addSecurityRecommendation ?? false,
    codeExpirationMinutes:     editing?.codeExpirationMinutes ?? null,
    messageSendTtlSeconds:     editing?.messageSendTtlSeconds ?? null,
  };
}

function toInput(draft: TemplateDraft, wabaId: string | null): TemplateInput {
  const carousel = draft.templateType === "CAROUSEL";
  const auth = draft.category === "AUTHENTICATION";
  const bodyVars = paramCount(draft.body, draft.parameterFormat);

  return {
    name:     draft.name.trim(),
    category: draft.category,
    language: draft.language,
    templateType:    draft.templateType,
    parameterFormat: draft.parameterFormat,
    body:     auth ? "" : draft.body,
    // null clears the column; undefined would leave whatever was there before.
    headerType:      carousel || auth || draft.headerType === "NONE" ? null : draft.headerType,
    headerContent:   carousel || auth || draft.headerType === "NONE" || draft.headerType === "LOCATION"
      ? null
      : draft.headerContent.trim() || null,
    headerVariables: draft.headerType === "TEXT" ? draft.headerVariables.filter((v) => v?.trim()) : [],
    variables:       auth ? [] : draft.variables.slice(0, bodyVars).map((v) => v?.trim() ?? ""),
    footer:          carousel || auth ? null : draft.footer.trim() || null,
    buttons:         draft.buttons,
    cards:           carousel ? draft.cards : null,
    ltoText:         draft.ltoText.trim() || null,
    ltoHasExpiration: Boolean(draft.ltoText.trim()) && draft.ltoHasExpiration,
    addSecurityRecommendation: auth ? draft.addSecurityRecommendation : false,
    codeExpirationMinutes:     auth ? draft.codeExpirationMinutes : null,
    messageSendTtlSeconds:     draft.messageSendTtlSeconds,
    wabaId,
  };
}

export function TemplateBuilder({
  open,
  editing,
  numberId,
  onClose,
  showToast,
}: {
  open: boolean;
  editing: TemplateDTO | null;
  /** The number chosen on the page, so a new template starts out in that account. */
  numberId?: string;
  onClose: () => void;
  showToast: (msg: string, kind: "success" | "error" | "info") => void;
}) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const [draft, setDraft] = useState<TemplateDraft>(() => initialDraft(editing));

  // Which WhatsApp account the template will be created in. Meta scopes templates to one
  // account, so this decides where it is submitted and which numbers may send it.
  const { hasChoice, defaultNumber, byId } = useWhatsAppNumbers();
  const [account, setAccount] = useState(numberId || "");
  const chosen = byId(account) ?? byId(numberId) ?? defaultNumber;

  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isAuth = draft.category === "AUTHENTICATION";
  const isCarousel = draft.templateType === "CAROUSEL";
  const pending = create.isPending || update.isPending;

  const bodyVars = paramCount(draft.body, draft.parameterFormat);
  const problems = useMemo(() => draftProblems(draft), [draft]);
  const bodyIssue = bodyProblem(draft.body, draft.parameterFormat);
  const headerIssue = headerProblem(draft.headerType, draft.headerContent, draft.parameterFormat);

  const scriptIssue = (() => {
    const script = SCRIPTS[draft.language];
    if (!script || !draft.body.trim() || script.pattern.test(draft.body)) return null;
    return `The language is ${script.label} but the body has no ${script.label} characters.`;
  })();

  /** Switching category changes which buttons are legal, so stale ones go. */
  function changeCategory(next: TemplateCategory) {
    setDraft((d) => ({
      ...d,
      category: next,
      buttons: next === "AUTHENTICATION"
        ? [{ type: "OTP" as const, otpType: "COPY_CODE" as const, text: "" }]
        : d.category === "AUTHENTICATION" ? [] : d.buttons,
      templateType: next === "AUTHENTICATION" ? "STANDARD" : d.templateType,
      ltoText: next === "MARKETING" ? d.ltoText : "",
    }));
  }

  function changeType(next: TemplateType) {
    setDraft((d) => ({
      ...d,
      templateType: next,
      // A carousel has no header or footer of its own; each card carries its media.
      ...(next === "CAROUSEL"
        ? { headerType: "NONE" as HeaderType, headerContent: "", footer: "", cards: d.cards.length ? d.cards : [emptyCard(), emptyCard()] }
        : {}),
    }));
  }

  function save() {
    if (problems.length) { showToast(problems[0], "error"); return; }
    // An existing template keeps the account it was approved in; changing it would point
    // the row at an account Meta never put it in.
    const payload = toInput(draft, editing ? null : chosen?.whatsappBusinessId ?? null);
    const request = editing
      ? update.mutateAsync({ id: editing.id, ...payload, wabaId: undefined })
      : create.mutateAsync(payload);
    request
      .then(() => {
        showToast(editing ? "Template saved." : "Draft created.", "success");
        onClose();
      })
      .catch((e: Error) => showToast(e.message, "error"));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit template" : "New template"}
      description="Submit it to Meta once it looks right. Approval takes anything from a few minutes to a few hours."
      className="sm:max-w-3xl"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); save(); }}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          {/* ── Fields ── */}
          <div className="min-w-0 space-y-4">
            <Field label="Name" htmlFor="tpl-name" required>
              <input
                id="tpl-name"
                value={draft.name}
                onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                className={cn(inputClass, "font-mono")}
                placeholder="order_confirmation"
              />
              <p className="mt-1 text-xs text-slate-500">Lowercase letters, numbers and underscores.</p>
            </Field>

            {/* Renders nothing when the workspace has one connected number. */}
            {!editing && hasChoice && (
              <NumberPicker
                id="tpl-number"
                label="WhatsApp account"
                value={account || chosen?.id || ""}
                onChange={setAccount}
                hint="The template is created in this number's WhatsApp account, and only numbers in that account can send it."
              />
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Category" htmlFor="tpl-category" required>
                <select
                  id="tpl-category"
                  value={draft.category}
                  onChange={(e) => changeCategory(e.target.value as TemplateCategory)}
                  className={inputClass}
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {CATEGORIES.find((c) => c.value === draft.category)?.hint}
                </p>
              </Field>

              <Field label="Language" htmlFor="tpl-language" required>
                <select
                  id="tpl-language"
                  value={draft.language}
                  onChange={(e) => set("language", e.target.value)}
                  className={cn(inputClass, scriptIssue && "border-amber-400 focus:ring-amber-400")}
                >
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                {scriptIssue && (
                  <p className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    {scriptIssue}
                  </p>
                )}
              </Field>
            </div>

            {/* ── Shape ── */}
            {!isAuth && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Layout</p>
                <div className="grid grid-cols-2 gap-2">
                  {LAYOUTS.map((o) => {
                    const active = draft.templateType === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => changeType(o.value)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          active
                            ? "border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-400"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                      >
                        <o.icon className={cn("h-4 w-4", active ? "text-emerald-600" : "text-slate-400")} />
                        <p className="mt-1.5 text-sm font-medium text-slate-900">{o.label}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{o.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Variable style ── */}
            {!isAuth && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">Variable style</p>
                  <p className="text-[11px] text-slate-500">
                    {draft.parameterFormat === "NAMED"
                      ? "Named, like {{first_name}}. Easier to read, and order does not matter."
                      : "Numbered, like {{1}}. Meta's default."}
                  </p>
                </div>
                <div className="flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
                  {(["POSITIONAL", "NAMED"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => set("parameterFormat", f)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                        draft.parameterFormat === f ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {f === "POSITIONAL" ? "{{1}}" : "{{name}}"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Authentication ── */}
            {isAuth && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="flex items-start gap-1.5 text-xs text-slate-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Meta writes the wording of an authentication template. You choose the options,
                  and pass the code as the first variable when you send it.
                </p>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-700">Add &ldquo;do not share this code&rdquo;</span>
                  <Toggle
                    checked={draft.addSecurityRecommendation}
                    onChange={(v) => set("addSecurityRecommendation", v)}
                    label="Add the security line"
                    size="sm"
                  />
                </label>
                <Field label="Code expires after" htmlFor="tpl-expiry">
                  <div className="flex items-center gap-2">
                    <input
                      id="tpl-expiry"
                      type="number"
                      min={LIMITS.codeExpirationMin}
                      max={LIMITS.codeExpirationMax}
                      value={draft.codeExpirationMinutes ?? ""}
                      onChange={(e) => set("codeExpirationMinutes", e.target.value ? Number(e.target.value) : null)}
                      className={cn(inputClass, "w-24")}
                      placeholder="10"
                    />
                    <span className="text-sm text-slate-500">
                      minutes, {LIMITS.codeExpirationMin}–{LIMITS.codeExpirationMax}. Leave empty to say nothing.
                    </span>
                  </div>
                </Field>
                <Field label="Stop retrying delivery after" htmlFor="tpl-ttl">
                  <div className="flex items-center gap-2">
                    <input
                      id="tpl-ttl"
                      type="number"
                      min={30}
                      value={draft.messageSendTtlSeconds ?? ""}
                      onChange={(e) => set("messageSendTtlSeconds", e.target.value ? Number(e.target.value) : null)}
                      className={cn(inputClass, "w-24")}
                      placeholder="60"
                    />
                    <span className="text-sm text-slate-500">seconds. A passcode nobody got is worth giving up on.</span>
                  </div>
                </Field>
              </div>
            )}

            {/* ── Header ── */}
            {!isCarousel && !isAuth && (
              <div className="space-y-2">
                <Field label="Header" htmlFor="tpl-header-type">
                  <select
                    id="tpl-header-type"
                    value={draft.headerType}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      headerType: e.target.value as HeaderType,
                      headerContent: "",
                      headerVariables: [],
                    }))}
                    className={inputClass}
                  >
                    {(Object.keys(HEADER_LABELS) as HeaderType[]).map((h) => (
                      <option key={h} value={h}>{HEADER_LABELS[h]}</option>
                    ))}
                  </select>
                </Field>

                {draft.headerType === "TEXT" && (
                  <>
                    <input
                      aria-label="Header text"
                      value={draft.headerContent}
                      onChange={(e) => set("headerContent", e.target.value)}
                      maxLength={LIMITS.headerTextChars + 20}
                      className={cn(inputClass, headerIssue && "border-rose-400 focus:ring-rose-400")}
                      placeholder="Your order is on its way"
                    />
                    {headerIssue && (
                      <p className="flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        {headerIssue}
                      </p>
                    )}
                    {paramCount(draft.headerContent, draft.parameterFormat) > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 truncate rounded bg-slate-100 px-2 py-1.5 text-center font-mono text-[11px] text-slate-600">
                          {paramLabel(draft.headerContent, 0, draft.parameterFormat)}
                        </span>
                        <input
                          aria-label="Header variable example"
                          value={draft.headerVariables[0] ?? ""}
                          onChange={(e) => set("headerVariables", [e.target.value])}
                          className={cn(inputClass, "text-xs")}
                          placeholder="Example value, like Aman"
                        />
                      </div>
                    )}
                  </>
                )}

                {MEDIA_HEADERS.includes(draft.headerType) && (
                  <MediaPicker
                    format={draft.headerType as "IMAGE" | "VIDEO" | "DOCUMENT"}
                    idPrefix="header"
                    value={{
                      handle: draft.headerContent || null,
                      url: draft.headerContent.startsWith("http") ? draft.headerContent : null,
                    }}
                    onChange={(v) => set("headerContent", v.handle ?? v.url ?? "")}
                  />
                )}

                {draft.headerType === "LOCATION" && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    The pin is set per message, not here. Marketing and utility templates only.
                  </p>
                )}
              </div>
            )}

            {/* ── Body ── */}
            {!isAuth && (
              <Field label={isCarousel ? "Message above the cards" : "Body"} htmlFor="tpl-body" required>
                <textarea
                  id="tpl-body"
                  value={draft.body}
                  onChange={(e) => set("body", e.target.value)}
                  rows={isCarousel ? 3 : 5}
                  className={cn(inputClass, "resize-y", bodyIssue && "border-rose-400 focus:ring-rose-400")}
                  placeholder={draft.parameterFormat === "NAMED"
                    ? "Hi {{first_name}}, your order {{order_id}} has shipped."
                    : "Hi {{1}}, your order {{2}} has shipped."}
                />
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    *bold*, _italic_ and ~strikethrough~ work here.
                  </p>
                  <span className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    draft.body.length > LIMITS.bodyChars ? "font-medium text-rose-600" : "text-slate-400",
                  )}>
                    {draft.body.length}/{LIMITS.bodyChars}
                  </span>
                </div>
                {bodyIssue && (
                  <p className="mt-1 flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    {bodyIssue}
                  </p>
                )}
              </Field>
            )}

            {!isAuth && bodyVars > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Examples for the variables</p>
                <div className="space-y-1.5">
                  {Array.from({ length: bodyVars }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate rounded bg-slate-100 px-2 py-1.5 text-center font-mono text-[11px] text-slate-600">
                        {paramLabel(draft.body, i, draft.parameterFormat)}
                      </span>
                      <input
                        aria-label={`Example ${i + 1}`}
                        value={draft.variables[i] ?? ""}
                        onChange={(e) => {
                          const next = [...draft.variables];
                          next[i] = e.target.value;
                          set("variables", next);
                        }}
                        className={inputClass}
                        placeholder={i === 0 ? "Aman" : i === 1 ? "ORD-12345" : "Example value"}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Meta&apos;s reviewer sees these. Customers never do.
                </p>
              </div>
            )}

            {/* ── Carousel ── */}
            {isCarousel && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Cards</p>
                <CarouselEditor draft={draft} onChange={(cards) => set("cards", cards)} />
              </div>
            )}

            {/* ── Footer ── */}
            {!isCarousel && !isAuth && (
              <Field label="Footer" htmlFor="tpl-footer">
                <input
                  id="tpl-footer"
                  value={draft.footer}
                  onChange={(e) => set("footer", e.target.value)}
                  maxLength={LIMITS.footerChars}
                  className={inputClass}
                  placeholder="Reply STOP to unsubscribe"
                />
              </Field>
            )}

            {/* ── Limited-time offer ── */}
            {draft.category === "MARKETING" && !isCarousel && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Timer className="h-3.5 w-3.5 text-slate-400" />
                    Limited-time offer
                  </span>
                  <Toggle
                    checked={Boolean(draft.ltoText)}
                    onChange={(v) => setDraft((d) => ({ ...d, ltoText: v ? "Expiring offer!" : "" }))}
                    label="Show a limited-time offer badge"
                    size="sm"
                  />
                </label>
                {draft.ltoText ? (
                  <>
                    <input
                      aria-label="Offer badge text"
                      value={draft.ltoText}
                      onChange={(e) => set("ltoText", e.target.value)}
                      maxLength={LIMITS.ltoTextChars}
                      className={inputClass}
                      placeholder="Expiring offer!"
                    />
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600">Run a countdown to the expiry</span>
                      <Toggle
                        checked={draft.ltoHasExpiration}
                        onChange={(v) => set("ltoHasExpiration", v)}
                        label="Run a countdown"
                        size="sm"
                      />
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Needs a copy-code button and a website button. The code and the expiry time
                      are set when the message goes out.
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Shows a countdown next to an offer code. Marketing templates only.
                  </p>
                )}
              </div>
            )}

            {/* ── Buttons ── */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                {isCarousel ? "Buttons under the message" : "Buttons"}
                {isAuth && <span className="ml-1.5 font-normal text-slate-400">· one passcode button</span>}
              </p>
              <ButtonsEditor
                draft={draft}
                buttons={draft.buttons}
                onChange={(next) => set("buttons", next)}
              />
            </div>
          </div>

          {/* ── Preview ── */}
          <div className="lg:sticky lg:top-2 lg:self-start">
            <TemplatePreview draft={draft} />
            {problems.length > 0 && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">
                  {problems.length} thing{problems.length > 1 ? "s" : ""} to fix before submitting
                </p>
                <ul className="mt-1.5 space-y-1">
                  {problems.slice(0, 6).map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-800">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      {p}
                    </li>
                  ))}
                  {problems.length > 6 && (
                    <li className="text-[11px] text-amber-700">and {problems.length - 6} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={pending || problems.length > 0} className="w-full sm:w-auto">
            {pending ? "Saving…" : editing ? "Save changes" : "Create draft"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
