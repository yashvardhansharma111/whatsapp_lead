"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Loader2, Save, UserCheck, Users } from "lucide-react";
import { Button, SkeletonText, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  KeywordList, NumberRow, SettingsCard, ToggleRow,
} from "@/components/settings/SettingsPrimitives";
import {
  useDepartments, useHandoverSettings, useSaveHandoverSettings, type HandoverConfig,
} from "@/hooks/useHandovers";
import { cn } from "@/lib/utils";

const STRATEGY_LABELS: Record<HandoverConfig["strategy"], { label: string; hint: string }> = {
  LEAST_BUSY:    { label: "Whoever is least busy", hint: "The person with the fewest conversations open." },
  ROUND_ROBIN:   { label: "Take turns",            hint: "Each transfer goes to the next person in the list." },
  DEPARTMENT:    { label: "A department",          hint: "The least busy member of the department you pick." },
  SPECIFIC_USER: { label: "One person",            hint: "Always the same colleague." },
};

/**
 * When a conversation leaves the AI, and who it goes to.
 *
 * Every switch here does something. That is worth saying because the previous version of
 * this feature collected a team, a queue and a department on the flow node and then
 * ignored all three.
 */
export function HandoverSettingsCard() {
  const { data, isLoading } = useHandoverSettings();
  const { data: departments = [] } = useDepartments();
  const save = useSaveHandoverSettings();
  const { showToast } = useToast();

  const [draft, setDraft] = useState<HandoverConfig | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Seeded once during render rather than in an effect, so a background refetch cannot
  // throw away something half-typed. The same pattern the AI settings page uses.
  if (data && !seeded) {
    setSeeded(true);
    setDraft(data.config);
  }

  const config = draft;
  const set = <K extends keyof HandoverConfig>(key: K, value: HandoverConfig[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  if (isLoading || !config) {
    return (
      <SettingsCard icon={UserCheck} title="Handing over to a person"
        description="When the AI should step aside, and who picks the conversation up.">
        <SkeletonText lines={4} />
      </SettingsCard>
    );
  }

  const noDepartments = departments.length === 0;

  function submit() {
    if (!config) return;
    save.mutateAsync(config)
      .then(() => showToast("Transfer settings saved.", "success"))
      .catch((e: Error) => showToast(e.message, "error"));
  }

  return (
    <SettingsCard
      icon={UserCheck}
      title="Handing over to a person"
      description="When the AI should step aside, and who picks the conversation up."
      action={
        <Button size="sm" onClick={submit} disabled={save.isPending} className="shrink-0">
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      }
    >
      <ToggleRow
        label="Hand conversations to people automatically"
        hint="With this off, only a flow or a colleague can hand one over."
        checked={config.enabled}
        onChange={(v) => set("enabled", v)}
      />

      <div className={cn("space-y-4", !config.enabled && "pointer-events-none opacity-50")}>
        {/* ── When ── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">When to hand over</p>
          <div className="space-y-2">
            <ToggleRow
              label="They ask for a person"
              hint="Matched on whole words, so “management fees” does not count."
              checked={config.onCustomerRequest}
              onChange={(v) => set("onCustomerRequest", v)}
            />
            {config.onCustomerRequest && (
              <KeywordList
                id="handover-keywords"
                label="The words that count"
                hint="One per line. Leave empty to use the built-in English list, or add your own in any language."
                value={config.requestKeywords}
                onChange={(v) => set("requestKeywords", v)}
                placeholderList={data?.defaultKeywords ?? []}
              />
            )}

            <ToggleRow
              label="The AI is unsure"
              hint="Costs one extra model call per message, so it is off by default."
              checked={config.onAiUnsure}
              onChange={(v) => set("onAiUnsure", v)}
            />
            {config.onAiUnsure && (
              <NumberRow
                id="handover-threshold"
                label="Hand over below this confidence"
                hint="The model rates how well it could answer, out of 100."
                value={config.aiUnsureThreshold}
                onChange={(v) => set("aiUnsureThreshold", v ?? 50)}
                min={0} max={100} unit="out of 100"
              />
            )}

            <ToggleRow
              label="They sound unhappy"
              hint="Shares the same model call as the setting above."
              checked={config.onNegativeSentiment}
              onChange={(v) => set("onNegativeSentiment", v)}
            />

            <NumberRow
              id="handover-after-replies"
              label="After this many AI replies in a row"
              hint="Counted since a person last said anything. Zero turns this off."
              value={config.afterAiReplies}
              onChange={(v) => set("afterAiReplies", v ?? 0)}
              min={0} max={50} unit="replies" placeholder="0"
            />

            <ToggleRow
              label="Outside business hours"
              hint="Uses the hours and timezone set in General settings."
              checked={config.offHours}
              onChange={(v) => set("offHours", v)}
            />
          </div>
        </div>

        {/* ── Who ── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Who gets it</p>
          <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <label htmlFor="handover-strategy" className="block text-sm font-medium text-slate-800">
                How to choose
              </label>
              <select
                id="handover-strategy"
                value={config.strategy}
                onChange={(e) => set("strategy", e.target.value as HandoverConfig["strategy"])}
                className={cn(inputClass, "mt-1.5")}
              >
                {(Object.keys(STRATEGY_LABELS) as HandoverConfig["strategy"][]).map((s) => (
                  <option key={s} value={s}>{STRATEGY_LABELS[s].label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">{STRATEGY_LABELS[config.strategy].hint}</p>
            </div>

            {config.strategy === "DEPARTMENT" && (
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <label htmlFor="handover-department" className="block text-sm font-medium text-slate-800">
                  Which department
                </label>
                {noDepartments ? (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    There are no departments yet.{" "}
                    <Link href="/settings?tab=departments" className="font-medium underline">Add one first.</Link>
                  </p>
                ) : (
                  <select
                    id="handover-department"
                    value={config.departmentId ?? ""}
                    onChange={(e) => set("departmentId", e.target.value || null)}
                    className={cn(inputClass, "mt-1.5")}
                  >
                    <option value="">The default department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.members.length} {d.members.length === 1 ? "person" : "people"}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <ToggleRow
              label="Skip people who are offline"
              hint="Falls back to everyone when nobody is connected, rather than leaving the customer waiting."
              checked={config.onlineOnly}
              onChange={(v) => set("onlineOnly", v)}
            />
          </div>
        </div>

        {/* ── What happens ── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">What happens next</p>
          <div className="space-y-2">
            <ToggleRow
              label="Stop the AI replying"
              hint="Recommended. Otherwise the AI keeps answering over whoever took the conversation."
              checked={config.pauseAi}
              onChange={(v) => set("pauseAi", v)}
            />
            <ToggleRow
              label="Tell the person who gets it"
              checked={config.notifyAgent}
              onChange={(v) => set("notifyAgent", v)}
            />
            <ToggleRow
              label="Tell managers about every handover"
              hint="They are always told when nobody could be found."
              checked={config.notifyManagers}
              onChange={(v) => set("notifyManagers", v)}
            />

            <div>
              <label htmlFor="handover-message" className="block text-sm font-medium text-slate-800">
                What to tell the customer
              </label>
              <input
                id="handover-message"
                value={config.customerMessage ?? ""}
                onChange={(e) => set("customerMessage", e.target.value || null)}
                maxLength={1000}
                className={cn(inputClass, "mt-1.5")}
                placeholder="One moment, I'm connecting you to a colleague."
              />
              <p className="mt-1 text-xs text-slate-500">Leave empty to say nothing.</p>
            </div>

            <NumberRow
              id="handover-escalate"
              label="Tell managers if nobody picks it up"
              hint="Zero turns this off. Checked every five minutes, and reported once per handover."
              value={config.escalateAfterMinutes}
              onChange={(v) => set("escalateAfterMinutes", v ?? 0)}
              min={0} max={1440} unit="minutes" placeholder="0"
            />
          </div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        Everything handed over shows up in{" "}
        <Link href="/handovers" className="font-medium text-emerald-700 underline">Handovers</Link>, with the
        reason and whether anyone has taken it.
      </p>
    </SettingsCard>
  );
}
