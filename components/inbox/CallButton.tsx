"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneCall } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { callApi, useCallability } from "@/hooks/useCalls";

/**
 * Call, or ask to be allowed to.
 *
 * A business cannot simply ring a WhatsApp user: Meta requires permission, it expires,
 * and it is withdrawn after four unanswered calls. The button used to offer a call
 * regardless and let Meta refuse it afterwards, which left the agent holding an error
 * code and no next step. It now asks Meta what is possible and offers that — a call, a
 * request, or the reason for neither.
 */
export function CallButton({
  contactId,
  displayName,
  controls,
}: {
  contactId: string;
  displayName?: string;
  controls: { placeCall: (id: string, name?: string) => Promise<void>; busy: boolean };
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useCallability(contactId);
  const [asking, setAsking] = useState(false);

  // Until Meta has answered, offer the call. The old behaviour is the safe default:
  // worst case Meta refuses and says why, which beats hiding a call that would work.
  const canCall = data?.canCall ?? true;
  const canAsk = !canCall && Boolean(data?.canRequest);

  async function ask() {
    setAsking(true);
    try {
      await callApi.requestPermission(contactId);
      showToast("Asked them to allow calls — they answer from their own chat", "success");
      void queryClient.invalidateQueries({ queryKey: ["callability", contactId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't ask for call permission", "error");
    } finally {
      setAsking(false);
    }
  }

  if (canAsk) {
    return (
      <button
        type="button"
        onClick={ask}
        disabled={asking}
        title={data?.reason ?? "Ask them to allow calls"}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PhoneCall className="h-4 w-4" />
        <span className="hidden sm:inline">{asking ? "Asking…" : "Ask to call"}</span>
      </button>
    );
  }

  const blocked = !canCall && !canAsk && !isLoading;
  const why = blocked
    ? data?.reason ?? "WhatsApp will not allow a call to this contact yet"
    : controls.busy
      ? "Finish the current call first"
      : data?.expiresAt
        ? `Call this contact — they allowed calls until ${new Date(data.expiresAt).toLocaleString()}`
        : "Call this contact";

  return (
    <button
      type="button"
      onClick={() => controls.placeCall(contactId, displayName)}
      disabled={controls.busy || blocked}
      title={why}
      aria-label={why}
      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Phone className="h-4 w-4" />
    </button>
  );
}
