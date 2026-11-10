"use client";

// The composer for a chat WhatsApp will not carry a typed message to.
//
// Free-form messages reach someone only for 24 hours after they last wrote. Outside that
// — and before they have ever written at all — an approved template is the only thing
// that arrives. Nothing in the inbox knew this: an agent typed a reply, watched it appear
// in the thread, and Meta refused it seconds later with "more than 24 hours since they
// last replied", wording the agent never saw on a message that still looked sent.
//
// So when the window is shut this replaces the text box rather than sitting beside it.
// Offering both would be offering one that cannot work.

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { useTemplates } from "@/hooks/useTemplates";
import {
  detectBodyVarSlots,
  dynamicUrlButtons,
  renderTemplateBody,
  unsupportedTemplateReason,
  type TemplateShape,
} from "@/lib/campaigns/templateVars";
import { cn } from "@/lib/utils";

interface TemplateOption {
  id: string;
  name: string;
  status?: string | null;
  category?: string | null;
  language?: string | null;
  body?: string | null;
  headerType?: string | null;
  headerContent?: string | null;
  buttons?: unknown;
}

/** The shape the variable helpers expect, with the nullable columns filled in. */
const asShape = (t: TemplateOption): TemplateShape => ({
  body: t.body ?? "",
  headerType: t.headerType ?? null,
  headerContent: t.headerContent ?? null,
  buttons: t.buttons,
});

export function TemplateComposer({
  conversationId,
  whatsappIntegrationId,
  reason,
  onSent,
}: {
  conversationId: string;
  whatsappIntegrationId?: string | null;
  /** Why the text box is not available, in words the agent can repeat to a colleague. */
  reason: string;
  onSent: () => void;
}) {
  const { data, isLoading } = useTemplates(whatsappIntegrationId ?? undefined);
  const [templateId, setTemplateId] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only approved templates can be sent, and a template with media or a carousel needs
  // a file chosen per send — which belongs in a campaign, not a one-off reply.
  const options = useMemo(
    () =>
      ((data ?? []) as TemplateOption[]).filter(
        (t) => t.status === "APPROVED" && !unsupportedTemplateReason(asShape(t)) && !t.headerType,
      ),
    [data],
  );

  const selected = options.find((t) => t.id === templateId) ?? null;
  const slots = selected ? detectBodyVarSlots(selected.body ?? "") : 0;
  const urlSlots = selected ? dynamicUrlButtons(asShape(selected)) : [];

  const missing =
    !selected ||
    Array.from({ length: slots }).some((_, i) => !(vars[i] ?? "").trim()) ||
    urlSlots.some((_, i) => !(urls[i] ?? "").trim());

  function pick(id: string) {
    setTemplateId(id);
    setVars([]);
    setUrls([]);
    setError(null);
  }

  async function send() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          bodyVarMapping: Array.from({ length: slots }, (_, i) => vars[i] ?? ""),
          urlButtonMapping: urlSlots.map((_, i) => urls[i] ?? ""),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send this template");
      setTemplateId("");
      setVars([]);
      setUrls([]);
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-slate-200 bg-amber-50/60 p-3">
      <p className="mb-2.5 text-xs leading-relaxed text-amber-900">{reason}</p>

      {isLoading ? (
        <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your templates…
        </p>
      ) : options.length === 0 ? (
        <p className="py-2 text-sm text-slate-600">
          No approved text template is available on this number yet. Create one under
          Templates, or wait for them to message you.
        </p>
      ) : (
        <div className="space-y-2">
          <select
            id={`tpl-${conversationId}`}
            aria-label="Template"
            className={inputClass}
            value={templateId}
            onChange={(e) => pick(e.target.value)}
          >
            <option value="">Choose a template…</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.category}] {t.name} ({t.language})
              </option>
            ))}
          </select>

          {selected && (
            <>
              {slots > 0 &&
                Array.from({ length: slots }).map((_, i) => (
                  <input
                    key={`v${i}`}
                    id={`tpl-${conversationId}-v${i}`}
                    aria-label={`Value for {{${i + 1}}}`}
                    className={inputClass}
                    placeholder={`Value for {{${i + 1}}}`}
                    value={vars[i] ?? ""}
                    onChange={(e) => {
                      const next = [...vars];
                      next[i] = e.target.value;
                      setVars(next);
                    }}
                  />
                ))}

              {urlSlots.map((b, i) => (
                <input
                  key={`u${i}`}
                  id={`tpl-${conversationId}-u${i}`}
                  aria-label={`Link for the ${b.text} button`}
                  className={inputClass}
                  placeholder={`Link for the “${b.text}” button`}
                  value={urls[i] ?? ""}
                  onChange={(e) => {
                    const next = [...urls];
                    next[i] = e.target.value;
                    setUrls(next);
                  }}
                />
              ))}

              {/* What the customer will actually read, with the values filled in. */}
              <p className="whitespace-pre-wrap wrap-anywhere rounded-lg bg-white p-2.5 text-xs leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200">
                {renderTemplateBody(selected.body ?? "", Array.from({ length: slots }, (_, i) => vars[i] ?? ""))}
              </p>
            </>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={missing || sending}
              onClick={send}
              className={cn(sending && "opacity-70")}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
