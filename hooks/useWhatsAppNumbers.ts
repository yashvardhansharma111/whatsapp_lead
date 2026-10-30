"use client";

import { useQuery } from "@tanstack/react-query";

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
