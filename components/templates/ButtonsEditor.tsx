"use client";

import { AlertCircle, Info, Plus, Trash2 } from "lucide-react";
import { inputClass } from "@/components/ui";
import {
  BUTTON_LABELS, CTA_BUTTON_TYPES, LIMITS,
  availableButtonTypes, buttonProblem,
  type ButtonType, type TemplateButtonDraft, type TemplateDraft,
} from "@/lib/templates/spec";
import { cn } from "@/lib/utils";

const OTP_LABELS: Record<string, string> = {
  COPY_CODE: "Copy code",
  ONE_TAP:   "One-tap autofill",
  ZERO_TAP:  "Zero-tap",
};

const OTP_HINTS: Record<string, string> = {
  COPY_CODE: "The customer taps to copy the code, then pastes it into your app.",
  ONE_TAP:   "Your app reads the code when the customer taps the button. Android only.",
  ZERO_TAP:  "Your app receives the code without the customer tapping anything. Android only, and you accept Meta's terms by using it.",
};

function fresh(type: ButtonType): TemplateButtonDraft {
  return {
    type,
    text: "",
    ...(type === "URL" ? { urlType: "STATIC" as const } : {}),
    ...(type === "OTP" ? { otpType: "COPY_CODE" as const } : {}),
    ...(type === "FLOW" ? { flowAction: "navigate" as const } : {}),
  };
}

/**
 * The buttons on a template, or on one carousel card.
 *
 * Which types can be added depends on what is already there: Meta refuses a mix of quick
 * replies and call-to-action buttons, and caps each type separately. Rather than letting
 * someone build an invalid set and explaining it afterwards, the options shrink.
 */
export function ButtonsEditor({
  draft,
  buttons,
  onChange,
  allowed,
  max = LIMITS.buttonsTotal,
}: {
  draft: Pick<TemplateDraft, "category" | "buttons">;
  buttons: TemplateButtonDraft[];
  onChange: (next: TemplateButtonDraft[]) => void;
  /** Narrower list for a carousel card. */
  allowed?: ButtonType[];
  max?: number;
}) {
  const patch = (i: number, change: Partial<TemplateButtonDraft>) =>
    onChange(buttons.map((b, idx) => (idx === i ? { ...b, ...change } : b)));

  const optionsFor = (excludeIndex?: number) => {
    const base = availableButtonTypes({ category: draft.category, buttons }, excludeIndex);
    return allowed ? base.filter((t) => allowed.includes(t)) : base;
  };

  const addable = buttons.length >= max ? [] : optionsFor();
  const mixed = buttons.some((b) => b.type === "QUICK_REPLY")
    && buttons.some((b) => CTA_BUTTON_TYPES.includes(b.type));

  return (
    <div className="space-y-2">
      {mixed && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Quick replies cannot sit alongside website, call or copy-code buttons. Remove one kind.
        </p>
      )}

      {buttons.map((b, i) => {
        const problem = buttonProblem(b);
        const options = optionsFor(i);
        const types = options.includes(b.type) ? options : [b.type, ...options];

        return (
          <div key={i} className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={`Button ${i + 1} type`}
                value={b.type}
                onChange={(e) => onChange(buttons.map((old, idx) => (idx === i ? fresh(e.target.value as ButtonType) : old)))}
                className={cn(inputClass, "w-full sm:w-44")}
              >
                {types.map((t) => (
                  <option key={t} value={t}>{BUTTON_LABELS[t]}</option>
                ))}
              </select>

              {b.type !== "OTP" && (
                <input
                  aria-label={`Button ${i + 1} label`}
                  value={b.text ?? ""}
                  onChange={(e) => patch(i, { text: e.target.value })}
                  maxLength={LIMITS.buttonTextChars}
                  className={cn(inputClass, "min-w-32 flex-1")}
                  placeholder={b.type === "COPY_CODE" ? "Copy code" : "Button label"}
                />
              )}

              <button
                type="button"
                onClick={() => onChange(buttons.filter((_, idx) => idx !== i))}
                className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Remove button ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {b.type === "URL" && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Button ${i + 1} URL kind`}
                    value={b.urlType ?? "STATIC"}
                    onChange={(e) => patch(i, { urlType: e.target.value as "STATIC" | "DYNAMIC", urlExample: "" })}
                    className={cn(inputClass, "w-32 text-xs")}
                  >
                    <option value="STATIC">Fixed link</option>
                    <option value="DYNAMIC">Ends in a variable</option>
                  </select>
                  <input
                    aria-label={`Button ${i + 1} URL`}
                    value={b.url ?? ""}
                    onChange={(e) => patch(i, { url: e.target.value })}
                    className={cn(inputClass, "min-w-48 flex-1")}
                    placeholder={b.urlType === "DYNAMIC" ? "https://example.com/track/{{1}}" : "https://example.com"}
                  />
                </div>
                {b.urlType === "DYNAMIC" && (
                  <input
                    aria-label={`Button ${i + 1} URL example`}
                    value={b.urlExample ?? ""}
                    onChange={(e) => patch(i, { urlExample: e.target.value })}
                    className={cn(inputClass, "text-xs")}
                    placeholder="Example value for the variable, like ABC123"
                  />
                )}
              </div>
            )}

            {(b.type === "PHONE_NUMBER" || b.type === "VOICE_CALL") && (
              <>
                <input
                  aria-label={`Button ${i + 1} phone number`}
                  value={b.phone ?? ""}
                  onChange={(e) => patch(i, { phone: e.target.value })}
                  className={inputClass}
                  placeholder="+919876543210"
                />
                {b.type === "VOICE_CALL" && (
                  <p className="text-[11px] text-slate-400">Tapping starts a WhatsApp call to this number.</p>
                )}
              </>
            )}

            {b.type === "COPY_CODE" && (
              <>
                <input
                  aria-label={`Button ${i + 1} code`}
                  value={b.offerCode ?? ""}
                  onChange={(e) => patch(i, { offerCode: e.target.value })}
                  maxLength={LIMITS.copyCodeChars}
                  className={inputClass}
                  placeholder="Example code, like SAVE20"
                />
                <p className="text-[11px] text-slate-400">
                  The real code is set when the message goes out. This one is only for the review.
                </p>
              </>
            )}

            {b.type === "OTP" && (
              <div className="space-y-2">
                <select
                  aria-label="One-time password delivery"
                  value={b.otpType ?? "COPY_CODE"}
                  onChange={(e) => patch(i, { otpType: e.target.value as TemplateButtonDraft["otpType"] })}
                  className={inputClass}
                >
                  {(["COPY_CODE", "ONE_TAP", "ZERO_TAP"] as const).map((t) => (
                    <option key={t} value={t}>{OTP_LABELS[t]}</option>
                  ))}
                </select>
                <p className="flex items-start gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-800">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  {OTP_HINTS[b.otpType ?? "COPY_CODE"]}
                </p>
                {b.otpType && b.otpType !== "COPY_CODE" && (
                  <div className="space-y-2">
                    <input
                      aria-label="Android package name"
                      value={b.packageName ?? ""}
                      onChange={(e) => patch(i, { packageName: e.target.value })}
                      className={cn(inputClass, "font-mono text-xs")}
                      placeholder="com.example.yourapp"
                    />
                    <input
                      aria-label="App signature hash"
                      value={b.signatureHash ?? ""}
                      onChange={(e) => patch(i, { signatureHash: e.target.value })}
                      className={cn(inputClass, "font-mono text-xs")}
                      placeholder="App signature hash"
                    />
                    <input
                      aria-label="Autofill button text"
                      value={b.autofillText ?? ""}
                      onChange={(e) => patch(i, { autofillText: e.target.value })}
                      className={cn(inputClass, "text-xs")}
                      placeholder="Autofill button text (optional)"
                    />
                  </div>
                )}
              </div>
            )}

            {b.type === "FLOW" && (
              <div className="space-y-2">
                <input
                  aria-label="Flow ID"
                  value={b.flowId ?? ""}
                  onChange={(e) => patch(i, { flowId: e.target.value })}
                  className={cn(inputClass, "font-mono text-xs")}
                  placeholder="Flow ID from your WhatsApp Manager"
                />
                <input
                  aria-label="First screen"
                  value={b.navigateScreen ?? ""}
                  onChange={(e) => patch(i, { navigateScreen: e.target.value })}
                  className={cn(inputClass, "text-xs")}
                  placeholder="First screen name (optional)"
                />
              </div>
            )}

            {problem && (
              <p className="flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {problem}
              </p>
            )}
          </div>
        );
      })}

      {addable.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addable.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange([...buttons, fresh(t)])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Plus className="h-3 w-3" />
              {BUTTON_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {buttons.length >= max && (
        <p className="text-[11px] text-slate-400">
          {max} button{max > 1 ? "s" : ""} is the limit here.
        </p>
      )}
    </div>
  );
}
