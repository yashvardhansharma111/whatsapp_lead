// Buying-intent vocabulary (shared server ⇄ client, no dependencies)

export type IntentWeight = "none" | "interest" | "buying";

export const INTENT_POINTS: Record<IntentWeight, number> = {
  none: 0,
  interest: 5,
  buying: 15,
};

export const INTENT_CHOICES: { value: IntentWeight; label: string; hint: string }[] = [
  { value: "none", label: "Nothing", hint: "Informational. Picking it says nothing about intent." },
  { value: "interest", label: "Interest", hint: "Researching — how it works, what is covered." },
  { value: "buying", label: "Buying", hint: "Pricing, ordering, availability, next steps." },
];

export function readIntent(raw: unknown): IntentWeight {
  return raw === "interest" || raw === "buying" ? raw : "none";
}
