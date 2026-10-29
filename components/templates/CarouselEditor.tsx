"use client";

import { AlertCircle, Copy, GripVertical, Info, Plus, Trash2 } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { ButtonsEditor } from "@/components/templates/ButtonsEditor";
import { MediaPicker } from "@/components/templates/MediaPicker";
import {
  CAROUSEL_BUTTON_TYPES, LIMITS,
  cardShape, emptyCard, paramCount, paramLabel,
  type TemplateCardDraft, type TemplateDraft,
} from "@/lib/templates/spec";
import { cn } from "@/lib/utils";

/**
 * The cards of a carousel.
 *
 * Meta's rule is that every card is built identically: the same media type, the same
 * buttons in the same order, and body text on all of them or none. Only the content
 * differs. So the first card is the one you design, and the others are added as copies of
 * its structure; a card that drifts out of shape is called out rather than silently
 * rejected after submission.
 */
export function CarouselEditor({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (cards: TemplateCardDraft[]) => void;
}) {
  const { cards } = draft;
  const reference = cards[0];
  const shapes = new Set(cards.map(cardShape));
  const outOfShape = shapes.size > 1;

  const patch = (i: number, change: Partial<TemplateCardDraft>) =>
    onChange(cards.map((c, idx) => (idx === i ? { ...c, ...change } : c)));

  /** A new card copies the first one's structure with its content cleared. */
  function addCard() {
    if (!reference) { onChange([emptyCard()]); return; }
    onChange([...cards, {
      headerFormat: reference.headerFormat,
      headerHandle: null,
      headerUrl: null,
      body: reference.body?.trim() ? "" : undefined,
      bodyVariables: [],
      buttons: (reference.buttons ?? []).map((b) => ({ ...b, url: b.url, text: b.text })),
    }]);
  }

  function duplicate(i: number) {
    const source = cards[i];
    onChange([...cards.slice(0, i + 1), { ...source, headerHandle: null, headerUrl: null }, ...cards.slice(i + 1)]);
  }

  function move(i: number, by: -1 | 1) {
    const target = i + by;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  }

  /** Push the first card's structure onto the rest, keeping each one's own content. */
  function alignAll() {
    if (!reference) return;
    onChange(cards.map((c, i) => (i === 0 ? c : {
      ...c,
      headerFormat: reference.headerFormat,
      body: reference.body?.trim() ? (c.body ?? "") : undefined,
      buttons: (reference.buttons ?? []).map((b, bi) => ({ ...b, ...(c.buttons?.[bi]?.url ? { url: c.buttons[bi].url } : {}) })),
    })));
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Every card is built the same way, which is Meta&apos;s rule, not ours. Design the first
        card and the rest follow its shape. Between {LIMITS.carouselCardsMin} and {LIMITS.carouselCardsMax} cards.
      </p>

      {outOfShape && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            These cards are no longer built the same way. Meta will refuse the template.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={alignAll}>
            Match the first card
          </Button>
        </div>
      )}

      {cards.map((card, i) => {
        const vars = paramCount(card.body ?? "", draft.parameterFormat);
        const differs = cards.length > 1 && reference && cardShape(card) !== cardShape(reference);

        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border bg-white p-3",
              differs ? "border-amber-300" : "border-slate-200",
            )}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              <span className="text-sm font-semibold text-slate-800">Card {i + 1}</span>
              {i === 0 && cards.length > 1 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  sets the shape
                </span>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  aria-label={`Move card ${i + 1} earlier`}
                >
                  ↑
                </button>
                <button
                  type="button" onClick={() => move(i, 1)} disabled={i === cards.length - 1}
                  className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  aria-label={`Move card ${i + 1} later`}
                >
                  ↓
                </button>
                {cards.length < LIMITS.carouselCardsMax && (
                  <button
                    type="button" onClick={() => duplicate(i)}
                    className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Duplicate card ${i + 1}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button" onClick={() => onChange(cards.filter((_, idx) => idx !== i))}
                  className="rounded p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove card ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {i === 0 ? (
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {(["IMAGE", "VIDEO"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onChange(cards.map((c) => ({ ...c, headerFormat: f, headerHandle: null, headerUrl: null })))}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
                        card.headerFormat === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {f === "IMAGE" ? "Image" : "Video"}
                    </button>
                  ))}
                </div>
              ) : null}

              <MediaPicker
                format={card.headerFormat}
                requireUrl
                idPrefix={`card-${i}`}
                value={{ handle: card.headerHandle ?? null, url: card.headerUrl ?? null }}
                onChange={(v) => patch(i, { headerHandle: v.handle, headerUrl: v.url })}
              />

              {card.body !== undefined && (
                <div>
                  <textarea
                    aria-label={`Card ${i + 1} text`}
                    value={card.body ?? ""}
                    onChange={(e) => patch(i, { body: e.target.value })}
                    rows={2}
                    className={cn(inputClass, "resize-y text-sm")}
                    placeholder="Card text, optional"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {draft.parameterFormat === "NAMED" ? "{{name}}" : "{{1}}"} works here too
                    </span>
                    <span className={cn(
                      "text-[11px] tabular-nums",
                      (card.body?.length ?? 0) > LIMITS.carouselBodyChars ? "font-medium text-rose-600" : "text-slate-400",
                    )}>
                      {card.body?.length ?? 0}/{LIMITS.carouselBodyChars}
                    </span>
                  </div>
                </div>
              )}

              {vars > 0 && (
                <div className="space-y-1.5">
                  {Array.from({ length: vars }, (_, vi) => (
                    <div key={vi} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 truncate rounded bg-slate-100 px-2 py-1.5 text-center font-mono text-[11px] text-slate-600">
                        {paramLabel(card.body ?? "", vi, draft.parameterFormat)}
                      </span>
                      <input
                        aria-label={`Card ${i + 1} example ${vi + 1}`}
                        value={card.bodyVariables?.[vi] ?? ""}
                        onChange={(e) => {
                          const next = [...(card.bodyVariables ?? [])];
                          next[vi] = e.target.value;
                          patch(i, { bodyVariables: next });
                        }}
                        className={cn(inputClass, "text-xs")}
                        placeholder="Example value for the review"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-slate-600">
                  Card buttons · up to {LIMITS.carouselButtons}
                </p>
                <ButtonsEditor
                  draft={{ category: draft.category, buttons: card.buttons ?? [] }}
                  buttons={card.buttons ?? []}
                  onChange={(next) => patch(i, { buttons: next })}
                  allowed={CAROUSEL_BUTTON_TYPES}
                  max={LIMITS.carouselButtons}
                />
              </div>
            </div>
          </div>
        );
      })}

      {cards.length < LIMITS.carouselCardsMax && (
        <button
          type="button"
          onClick={addCard}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add a card{cards.length ? " with the same shape" : ""}
        </button>
      )}
    </div>
  );
}
