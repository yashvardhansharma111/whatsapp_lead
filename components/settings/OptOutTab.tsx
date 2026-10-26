"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, MessageSquare, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

const DEFAULT_OPT_OUT = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT"];
const DEFAULT_OPT_IN  = ["START", "SUBSCRIBE", "YES"];

interface OptOutConfig {
  optOutKeywords: string[];
  optInKeywords:  string[];
  optOutReply:    string;
  optInReply:     string;
}

function KeywordList({
  keywords,
  onChange,
  placeholder,
}: {
  keywords: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const val = input.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!val || keywords.includes(val)) { setInput(""); return; }
    onChange([...keywords, val]);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700"
          >
            {kw}
            <button
              type="button"
              onClick={() => onChange(keywords.filter((k) => k !== kw))}
              className="ml-0.5 text-slate-400 hover:text-rose-500"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-8 w-40 rounded-lg border border-slate-200 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function OptOutTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading } = useQuery<OptOutConfig>({
    queryKey: ["settings-opt-out"],
    queryFn: async () => {
      const r = await fetch("/api/settings/opt-out");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Failed to load");
      return j.data ?? j;
    },
  });

  const [optOutKeywords, setOptOutKeywords] = useState<string[]>(DEFAULT_OPT_OUT);
  const [optInKeywords, setOptInKeywords]   = useState<string[]>(DEFAULT_OPT_IN);
  const [optOutReply, setOptOutReply]       = useState(
    "You have been unsubscribed and will no longer receive marketing messages from us. Reply START to re-subscribe.",
  );
  const [optInReply, setOptInReply] = useState(
    "You have been re-subscribed and will receive messages from us again. Reply STOP to unsubscribe.",
  );

  useEffect(() => {
    if (!data) return;
    setOptOutKeywords(data.optOutKeywords);
    setOptInKeywords(data.optInKeywords);
    setOptOutReply(data.optOutReply);
    setOptInReply(data.optInReply);
  }, [data]);

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

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-6">
      {/* How it works */}
      <Card className="border-blue-100 bg-blue-50 p-4">
        <p className="flex items-start gap-2 text-sm text-blue-800">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>
            When a contact replies with an <strong>opt-out keyword</strong>, they are unsubscribed and won't receive
            marketing/utility campaigns. If they later reply with an <strong>opt-in keyword</strong>, they're
            re-subscribed. The default keywords are always active — add custom ones below.
          </span>
        </p>
      </Card>

      {/* Opt-out keywords */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Opt-out keywords</h3>
            <p className="text-xs text-slate-500">Contact sends one of these → unsubscribed instantly</p>
          </div>
          <button
            type="button"
            onClick={() => setOptOutKeywords(DEFAULT_OPT_OUT)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <KeywordList keywords={optOutKeywords} onChange={setOptOutKeywords} placeholder="e.g. NAHI" />
      </Card>

      {/* Opt-in keywords */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Opt-in keywords</h3>
            <p className="text-xs text-slate-500">Contact sends one of these while opted-out → re-subscribed</p>
          </div>
          <button
            type="button"
            onClick={() => setOptInKeywords(DEFAULT_OPT_IN)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <KeywordList keywords={optInKeywords} onChange={setOptInKeywords} placeholder="e.g. HAAN" />
      </Card>

      {/* Auto-reply messages */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Auto-reply messages</h3>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Opt-out confirmation</label>
          <textarea
            value={optOutReply}
            onChange={(e) => setOptOutReply(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-[11px] text-slate-400">Sent immediately after the contact opts out.</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Opt-in confirmation</label>
          <textarea
            value={optInReply}
            onChange={(e) => setOptInReply(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-[11px] text-slate-400">Sent immediately after the contact re-subscribes.</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
