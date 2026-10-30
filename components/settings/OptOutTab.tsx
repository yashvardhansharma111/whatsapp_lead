"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, MessageSquare, ShieldCheck, UserRoundPlus } from "lucide-react";
import { Button, Skeleton, SkeletonCard } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ChipInput, ResetButton, SettingsCard, SettingsIntro } from "@/components/settings/SettingsPrimitives";

const DEFAULT_OPT_OUT = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT"];
const DEFAULT_OPT_IN  = ["START", "SUBSCRIBE", "YES"];
const DEFAULT_OUT_REPLY =
  "You have been unsubscribed and will no longer receive marketing messages from us. Reply START to re-subscribe.";
const DEFAULT_IN_REPLY =
  "You have been re-subscribed and will receive messages from us again. Reply STOP to unsubscribe.";

const REPLY_CLASS =
  "mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition " +
  "focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

interface OptOutConfig {
  optOutKeywords: string[];
  optInKeywords:  string[];
  optOutReply:    string;
  optInReply:     string;
  updatedAt?:     string;
}

export function OptOutTab() {
  const { data, isLoading } = useQuery<OptOutConfig>({
    queryKey: ["settings-opt-out"],
    queryFn: async () => {
      const r = await fetch("/api/settings/opt-out");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Failed to load");
      return j.data ?? j;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-xl" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  // The form owns the edits, so the saved values are its starting point rather than
  // something copied into state after the fact. Remounting on a fresh load is what
  // discards a stale draft, and it is why there is no effect syncing the two.
  return <OptOutForm key={data.updatedAt ?? "loaded"} saved={data} />;
}

function OptOutForm({ saved }: { saved: OptOutConfig }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [optOutKeywords, setOptOutKeywords] = useState<string[]>(saved.optOutKeywords ?? DEFAULT_OPT_OUT);
  const [optInKeywords, setOptInKeywords]   = useState<string[]>(saved.optInKeywords ?? DEFAULT_OPT_IN);
  const [optOutReply, setOptOutReply]       = useState(saved.optOutReply || DEFAULT_OUT_REPLY);
  const [optInReply, setOptInReply]         = useState(saved.optInReply || DEFAULT_IN_REPLY);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/settings/opt-out", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOutKeywords, optInKeywords, optOutReply, optInReply }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-opt-out"] });
      showToast("Opt-out settings saved.", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  return (
    <div className="space-y-5">
      <SettingsIntro icon={ShieldCheck} title="Give control to your contacts" storageKey="opt-out">
        When a contact replies with an <strong className="font-semibold">opt-out keyword</strong> they are
        unsubscribed at once and stop receiving marketing and utility campaigns. Reply with an{" "}
        <strong className="font-semibold">opt-in keyword</strong> and they are back. The defaults below are
        always active — anything you add joins them.
      </SettingsIntro>

      <SettingsCard
        icon={Ban}
        tone="rose"
        title="Opt-out keywords"
        description="A contact sending one of these is unsubscribed instantly."
        action={<ResetButton onClick={() => setOptOutKeywords(DEFAULT_OPT_OUT)} />}
      >
        <ChipInput
          inputId="opt-out-keyword"
          values={optOutKeywords}
          onChange={setOptOutKeywords}
          placeholder="e.g. NAHI"
          emptyHint="No keywords — nobody can unsubscribe by replying."
        />
      </SettingsCard>

      <SettingsCard
        icon={UserRoundPlus}
        tone="emerald"
        title="Opt-in keywords"
        description="Sent by someone already opted out, these re-subscribe them."
        action={<ResetButton onClick={() => setOptInKeywords(DEFAULT_OPT_IN)} />}
      >
        <ChipInput
          inputId="opt-in-keyword"
          values={optInKeywords}
          onChange={setOptInKeywords}
          placeholder="e.g. HAAN"
          emptyHint="No keywords — a contact who opts out cannot come back on their own."
        />
      </SettingsCard>

      <SettingsCard
        icon={MessageSquare}
        tone="blue"
        title="Auto-reply messages"
        description="The confirmation sent the moment someone opts out or back in."
        action={
          <ResetButton
            onClick={() => { setOptOutReply(DEFAULT_OUT_REPLY); setOptInReply(DEFAULT_IN_REPLY); }}
          />
        }
      >
        <div>
          <label htmlFor="opt-out-reply" className="block text-sm font-medium text-slate-800">
            Opt-out confirmation
          </label>
          <textarea
            id="opt-out-reply"
            value={optOutReply}
            onChange={(e) => setOptOutReply(e.target.value)}
            rows={3}
            className={REPLY_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">Sent immediately after the contact opts out.</p>
        </div>
        <div>
          <label htmlFor="opt-in-reply" className="block text-sm font-medium text-slate-800">
            Opt-in confirmation
          </label>
          <textarea
            id="opt-in-reply"
            value={optInReply}
            onChange={(e) => setOptInReply(e.target.value)}
            rows={3}
            className={REPLY_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">Sent immediately after the contact re-subscribes.</p>
        </div>
      </SettingsCard>

      <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-slate-200/70 bg-[#f6f7f9]/85 px-1 py-3 backdrop-blur-sm">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
