"use client";

import { Loader2, Phone } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useFeature } from "@/hooks/useFeature";
import { useCallingSettings, useSetCalling } from "@/hooks/useCalls";
import { cn } from "@/lib/utils";

/**
 * Per-number switch for WhatsApp calling. Reads Meta's setting through the backend
 * and writes it back; hidden entirely when the plan has no calling.
 */
export function CallingToggle({ integrationId, disabled }: { integrationId: string; disabled?: boolean }) {
  const enabled = useFeature("callingEnabled");
  const { showToast } = useToast();
  const settings = useCallingSettings(enabled ? integrationId : null);
  const save = useSetCalling();

  if (!enabled) return null;

  const on = settings.data?.enabled ?? false;
  const busy = settings.isLoading || save.isPending;

  const follows = settings.data?.followBusinessHours ?? false;

  async function toggle() {
    try {
      const next = !on;
      await save.mutateAsync({ integrationId, enabled: next });
      showToast(next ? "Calling is on. Customers now see a call button on WhatsApp." : "Calling is off for this number.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't update calling", "error");
    }
  }

  /**
   * Handing the switch to the department's hours.
   *
   * Turning it off deliberately leaves calling wherever it currently is rather than
   * forcing it on, so switching the schedule off at night does not start ringing phones
   * nobody is sitting at.
   */
  async function toggleSchedule() {
    try {
      const next = !follows;
      await save.mutateAsync({ integrationId, enabled: on, followBusinessHours: next });
      showToast(
        next
          ? "Calling now follows this department's business hours."
          : "Calling no longer follows business hours; it stays as it is now.",
        "success",
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't update calling", "error");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Phone className={cn("mt-0.5 h-4 w-4 shrink-0", on ? "text-emerald-600" : "text-slate-400")} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">WhatsApp calling</p>
          <p className="text-xs text-slate-500">
            {settings.data?.error
              ? `Couldn't read the setting from Meta: ${settings.data.error}`
              : on
                ? "Customers can call this number; agents answer from the inbox."
                : "Off. Needs the calls webhook subscribed in your Meta app and the 2,000/day tier."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="WhatsApp calling"
        disabled={disabled || busy}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50",
          on ? "bg-emerald-600" : "bg-slate-300",
        )}
      >
        {busy ? (
          <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-white" />
        ) : (
          <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition", on ? "translate-x-5" : "translate-x-0.5")} />
        )}
      </button>

      <label className="flex w-full cursor-pointer items-start gap-2.5 border-t border-slate-200 pt-2.5">
        <input
          type="checkbox"
          checked={follows}
          disabled={disabled || busy}
          onChange={toggleSchedule}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
        />
        <span className="min-w-0">
          <span className="block text-sm text-slate-800">Follow business hours</span>
          <span className="block text-xs text-slate-500">
            Calling opens and closes with this department&apos;s working hours, so nobody
            calls a phone no one is sitting at. Set the hours in Business profile.
          </span>
        </span>
      </label>
    </div>
  );
}
