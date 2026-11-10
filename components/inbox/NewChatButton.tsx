"use client";

// Starts a chat with a number that has not written in.
//
// A conversation could only begin with the customer messaging first, so a business
// holding someone's number had nowhere in the inbox to reach them — the whole of the
// outbound half of WhatsApp was reachable only through a campaign.
//
// Opening the thread is all this does. Whether the first message can be typed or has to
// be an approved template is WhatsApp's 24-hour rule, and the composer answers it once
// the thread is open.

import { useState } from "react";
import { Loader2, MessageSquarePlus, X } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { normalizePhone, displayPhone } from "@/lib/phone";

export function NewChatButton({ onOpened }: { onOpened: (conversationId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = normalizePhone(phone);
  const ready = digits.length >= 8 && digits.length <= 15;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, name: name.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't open this chat");
      const { conversationId } = (json.data ?? json) as { conversationId: string };
      setOpen(false);
      setPhone("");
      setName("");
      onOpened(conversationId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        aria-label="New chat"
        title="New chat"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <MessageSquarePlus className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="New chat"
        >
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">New chat</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                WhatsApp number
              </span>
              <input
                id="new-chat-phone"
                className={inputClass}
                inputMode="tel"
                placeholder="919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <span className="mt-1 block text-xs text-slate-500">
                {digits.length >= 8
                  ? `Opening a chat with ${displayPhone(digits)}`
                  : "Include the country code."}
              </span>
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Name <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                id="new-chat-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            {error && (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}

            <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              If they have never written to you, WhatsApp only allows an approved template
              first. The composer will offer one.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={!ready || busy} onClick={start}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                Open chat
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
