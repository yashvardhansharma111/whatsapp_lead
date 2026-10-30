"use client";

import { useState } from "react";
import { Info, Loader2, RotateCcw, Save, Sparkles, Target } from "lucide-react";
import { Button, SkeletonText, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  KeywordList, NumberRow, SettingsCard, ToggleRow,
} from "@/components/settings/SettingsPrimitives";
import {
  useLeadQualification, useSaveLeadQualification,
  type LeadQualificationConfig, type QualificationCriterion,
} from "@/hooks/useLeadQualification";
import { cn } from "@/lib/utils";

const TRIGGER_LABELS: Record<string, { label: string; hint: string }> = {
  AFTER_MESSAGES: { label: "After a few messages", hint: "Once the customer has sent enough for there to be something to judge." },
  ON_HANDOVER:    { label: "When it reaches a person", hint: "Scored at the moment the AI hands the conversation over." },
  ON_CLOSE:       { label: "When the conversation is closed", hint: "One score at the end, from the whole thread." },
  MANUAL:         { label: "Only when asked", hint: "Nothing happens automatically. Score a conversation from its thread." },
};

const CRITERION_LABELS: Record<QualificationCriterion, { label: string; hint: string }> = {
  budget:     { label: "Budget",     hint: "Signs they can pay, or have said what they can spend." },
  authority:  { label: "Authority",  hint: "Signs they can decide, or speak for whoever does." },
  need:       { label: "Need",       hint: "How clear and real their requirement is." },
  timeline:   { label: "Timeline",   hint: "How soon they want it." },
  engagement: { label: "Engagement", hint: "How responsive and interested they are." },
};

const BAND_LABELS: Record<string, string> = {
  qualified: "Qualified · 80 and above",
  hot:       "Hot · 65 to 79",
  warm:      "Warm · 40 to 64",
  cold:      "Cold · under 40",
};

/**
 * How the model judges a conversation.
 *
 * The weights are the interesting part. They are not sent to the model — the model rates
 * each criterion and the weighted sum is computed on the server, so moving a slider
 * changes every future score immediately and the arithmetic stays explainable.
 */
export function LeadQualificationCard() {
  const { data, isLoading } = useLeadQualification();
  const save = useSaveLeadQualification();
  const { showToast } = useToast();

  const [draft, setDraft] = useState<LeadQualificationConfig | null>(null);
  const [seeded, setSeeded] = useState(false);

  if (data && !seeded) {
    setSeeded(true);
    setDraft({
      ...data.config,
      weights: data.config.weights ?? { ...data.defaultWeights },
      stageMap: data.config.stageMap ?? {},
    });
  }

  const config = draft;
  const set = <K extends keyof LeadQualificationConfig>(key: K, value: LeadQualificationConfig[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  if (isLoading || !config || !data) {
    return (
      <SettingsCard icon={Target} title="Scoring leads with AI"
        description="Let the model read a conversation and judge whether it is worth following up.">
        <SkeletonText lines={4} />
      </SettingsCard>
    );
  }

  const weights = config.weights ?? data.defaultWeights;
  const weightTotal = data.criteria.reduce((sum, k) => sum + (weights[k] ?? 0), 0);

  /** What each criterion is actually worth once normalised, which is what gets applied. */
  const share = (k: QualificationCriterion) =>
    weightTotal > 0 ? Math.round(((weights[k] ?? 0) / weightTotal) * 100) : 0;

  function submit() {
    if (!config) return;
    save.mutateAsync(config)
      .then(() => showToast("Lead scoring saved.", "success"))
      .catch((e: Error) => showToast(e.message, "error"));
  }

  return (
    <SettingsCard
      icon={Target}
      title="Scoring leads with AI"
      description="The model reads a conversation, rates it against your criteria and opens a lead."
      action={
        <Button size="sm" onClick={submit} disabled={save.isPending} className="shrink-0">
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      }
    >
      <ToggleRow
        label="Score conversations and open leads"
        hint="Nothing is scored until this is on."
        checked={config.enabled}
        onChange={(v) => set("enabled", v)}
      />

      <div className={cn("space-y-4", !config.enabled && "pointer-events-none opacity-50")}>
        {/* ── What the business sells ── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">What to judge against</p>
          <div className="space-y-3">
            <div>
              <label htmlFor="lq-product" className="block text-sm font-medium text-slate-800">
                What you sell
              </label>
              <textarea
                id="lq-product"
                rows={3}
                value={config.productContext ?? ""}
                onChange={(e) => set("productContext", e.target.value || null)}
                maxLength={4000}
                className={cn(inputClass, "mt-1.5 resize-y")}
                placeholder="Bulk WhatsApp messaging for Indian retailers. Plans from 2,000 to 50,000 rupees a month."
              />
              <p className="mt-1 text-xs text-slate-500">
                Without this the model has to guess whether an enquiry fits.
              </p>
            </div>

            <div>
              <label htmlFor="lq-instructions" className="block text-sm font-medium text-slate-800">
                What counts as a good lead
              </label>
              <textarea
                id="lq-instructions"
                rows={3}
                value={config.instructions ?? ""}
                onChange={(e) => set("instructions", e.target.value || null)}
                maxLength={4000}
                className={cn(inputClass, "mt-1.5 resize-y")}
                placeholder="Retailers with more than five stores. Anyone asking only about the free tier is not a lead."
              />
              <p className="mt-1 text-xs text-slate-500">In your own words. Added to the model&apos;s instructions.</p>
            </div>
          </div>
        </div>

        {/* ── Weights ── */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              What matters, and how much
            </p>
            <button
              type="button"
              onClick={() => set("weights", { ...data.defaultWeights })}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            {data.criteria.map((k) => (
              <div key={k}>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`lq-w-${k}`} className="text-sm font-medium text-slate-800">
                    {CRITERION_LABELS[k].label}
                  </label>
                  <span className="text-xs tabular-nums text-slate-500">
                    {share(k)}% of the score
                  </span>
                </div>
                <input
                  id={`lq-w-${k}`}
                  type="range"
                  min={0}
                  max={100}
                  value={weights[k] ?? 0}
                  onChange={(e) => set("weights", { ...weights, [k]: Number(e.target.value) })}
                  className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
                />
                <p className="mt-0.5 text-xs text-slate-500">{CRITERION_LABELS[k].hint}</p>
              </div>
            ))}
            <p className="flex items-start gap-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              These are shares, not a total. Set one to zero to ignore it; the rest take up the slack.
            </p>
          </div>
        </div>

        {/* ── When ── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">When to score</p>
          <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <label htmlFor="lq-trigger" className="block text-sm font-medium text-slate-800">Trigger</label>
              <select
                id="lq-trigger"
                value={config.trigger}
                onChange={(e) => set("trigger", e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              >
                {data.triggers.map((t) => (
                  <option key={t} value={t}>{TRIGGER_LABELS[t]?.label ?? t}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">{TRIGGER_LABELS[config.trigger]?.hint}</p>
            </div>

            {config.trigger === "AFTER_MESSAGES" && (
              <NumberRow
                id="lq-after"
                label="Wait for this many messages from the customer"
                value={config.afterMessages}
                onChange={(v) => set("afterMessages", v ?? 6)}
                min={1} max={100} unit="messages"
              />
            )}

            <ToggleRow
              label="Score again as the conversation develops"
              hint="The same lead is updated, never duplicated."
              checked={config.requalify}
              onChange={(v) => set("requalify", v)}
            />
            {config.requalify && (
              <NumberRow
                id="lq-requalify"
                label="But not more often than"
                value={config.requalifyAfterHours}
                onChange={(v) => set("requalifyAfterHours", v ?? 24)}
                min={1} max={720} unit="hours apart"
              />
            )}

            <KeywordList
              id="lq-keywords"
              label="Only score conversations mentioning"
              hint="One per line. Leave empty to consider every conversation."
              value={config.keywords}
              onChange={(v) => set("keywords", v)}
              placeholderList={["price", "pricing", "quote", "demo"]}
            />
          </div>
        </div>

        {/* ── What to do with the result ── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">What to do with the score</p>
          <div className="space-y-2">
            <NumberRow
              id="lq-min"
              label="Only open a lead at or above"
              hint="Keeps browsers out of the pipeline. Zero opens one every time."
              value={config.minScore}
              onChange={(v) => set("minScore", v ?? 0)}
              min={0} max={100} unit="out of 100"
            />
            <ToggleRow
              label="Give the lead to whoever has the conversation"
              checked={config.autoAssign}
              onChange={(v) => set("autoAssign", v)}
            />
            <NumberRow
              id="lq-notify"
              label="Tell someone when a lead scores at least"
              hint="Zero turns this off. Goes to the assigned agent, or to managers."
              value={config.notifyAboveScore}
              onChange={(v) => set("notifyAboveScore", v ?? 0)}
              min={0} max={100} unit="out of 100"
            />

            {data.stages.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">Which stage each score lands in</p>
                <div className="mt-2 space-y-2">
                  {Object.keys(BAND_LABELS).map((band) => (
                    <div key={band} className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`lq-stage-${band}`} className="w-40 shrink-0 text-xs text-slate-600">
                        {BAND_LABELS[band]}
                      </label>
                      <select
                        id={`lq-stage-${band}`}
                        value={config.stageMap?.[band] ?? ""}
                        onChange={(e) => set("stageMap", { ...(config.stageMap ?? {}), [band]: e.target.value })}
                        className={cn(inputClass, "min-w-40 flex-1 text-sm")}
                      >
                        <option value="">The pipeline&apos;s first stage</option>
                        {data.stages.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        A scored lead keeps the model&apos;s summary, its next step and the per-criterion
        breakdown, so any score can be taken apart. Anything an agent corrects by hand is
        never overwritten by a later run.
      </p>
    </SettingsCard>
  );
}
