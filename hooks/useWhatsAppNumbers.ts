"use client";

import { useQuery } from "@tanstack/react-query";
import { useStickyState } from "@/hooks/useStickyState";

export interface WhatsAppNumber {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  whatsappBusinessId: string | null;
  isDefault: boolean;
  isActive: boolean;
}

/** "Support line · +1 555-194-4019", or the best of whatever is known. */
export function numberLabel(n: WhatsAppNumber | null | undefined): string {
  if (!n) return "Unknown number";
  const phone = n.phoneNumber ? (n.phoneNumber.startsWith("+") ? n.phoneNumber : `+${n.phoneNumber}`) : null;
  if (n.displayName?.trim() && phone) return `${n.displayName.trim()} · ${phone}`;
  return n.displayName?.trim() || phone || "Unnamed number";
}

/** The short form, for a badge where space is tight. */
export function numberShort(n: WhatsAppNumber | null | undefined): string {
  if (!n) return "—";
  if (n.displayName?.trim()) return n.displayName.trim();
  const phone = n.phoneNumber ?? "";
  return phone ? (phone.startsWith("+") ? phone : `+${phone}`) : "Unnamed";
}

/**
 * The WhatsApp numbers connected to this workspace.
 *
 * A workspace can connect several, and almost everything that sends is tied to one: a
 * conversation belongs to the number it arrived on, a campaign goes out from one, and a
 * template can only be sent from a number in its own WhatsApp account. Anywhere a choice
 * exists, this is where the options come from.
 */
export function useWhatsAppNumbers() {
  const query = useQuery({
    queryKey: ["whatsapp-integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/whatsapp");
      // A role that may not read this has no chooser to show — which is the same as
      // having one number. Treating it as an error would put a red failure on every
      // page that merely offers the filter.
      if (res.status === 403) return [] as WhatsAppNumber[];
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't load your WhatsApp numbers");
      const data = json.data ?? json;
      return (data.integrations ?? []) as WhatsAppNumber[];
    },
    staleTime: 60_000,
  });

  const all = query.data ?? [];
  const active = all.filter((n) => n.isActive);

  return {
    ...query,
    numbers: active,
    /** Only worth showing a chooser when there is actually a choice. */
    hasChoice: active.length > 1,
    defaultNumber: active.find((n) => n.isDefault) ?? active[0] ?? null,
    byId: (id: string | null | undefined) => active.find((n) => n.id === id) ?? null,
  };
}

/**
 * The number the whole app is filtered to, remembered across a refresh.
 *
 * One choice, made once in the top bar. It used to be per view — the inbox and the
 * template list each kept their own — which meant picking a number in one place and
 * finding the other still showing everything, with two dropdowns on screen saying
 * different things.
 *
 * No provider: `useStickyState` is a `useSyncExternalStore` over one localStorage key
 * with a shared listener, so every caller of this hook already re-renders together,
 * wherever it sits in the tree.
 *
 * A remembered id that no longer resolves — the number was removed, or belongs to a
 * workspace since switched away from — reads as "all numbers" rather than leaving the
 * chooser blank and the list silently empty.
 */
export function useNumberFilter() {
  const query = useWhatsAppNumbers();
  const [stored, setNumberId] = useStickyState("wa.number");

  const known = stored ? query.numbers.some((n) => n.id === stored) : false;

  // Always a particular number, never "all of them". Working two numbers' inboxes as one
  // list reads as a single conversation history that it is not: two customers, two
  // threads, two different senders, interleaved by time with nothing distinguishing them.
  // A remembered id that no longer resolves — the number was removed, or belongs to a
  // workspace since switched away from — falls back to the default rather than leaving
  // the chooser blank.
  return {
    ...query,
    numberId: known ? stored : query.defaultNumber?.id ?? "",
    setNumberId,
  };
}
