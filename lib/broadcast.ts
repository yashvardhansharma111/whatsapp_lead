// Bulk broadcast — pasted-number parsing (isomorphic, no React/Prisma)

import { DEFAULT_COUNTRY_CODE, IMPORT_MAX_ROWS, isValidPhone, normalizePhone } from "@/lib/import";

export { DEFAULT_COUNTRY_CODE };

export const BROADCAST_MAX_NUMBERS = IMPORT_MAX_ROWS;

export function splitNumberInput(text: string): string[] {
  return text
    .split(/[\n\r,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type NormalizedNumber =
  | { ok: true; phone: string }
  | { ok: false; reason: string };

export function normalizeBroadcastNumber(raw: string, countryCode: string): NormalizedNumber {
  const text = raw.trim();
  if (/^\d(\.\d+)?e\+?\d+$/i.test(text)) {
    return { ok: false, reason: "Scientific notation — format the column as Text in Excel" };
  }
  if (/[^\d\s+\-().]/.test(text)) return { ok: false, reason: "Contains letters or symbols" };

  const digits = normalizePhone(text, countryCode);
  if (!digits) return { ok: false, reason: "No digits" };

  if (digits.length < 10) return { ok: false, reason: "Too short" };
  if (digits.length > 15) return { ok: false, reason: "Too long" };
  if (!isValidPhone(digits)) return { ok: false, reason: "Not a valid phone number" };
  return { ok: true, phone: digits };
}

export interface NumberAnalysis {
  total: number;
  valid: string[];
  invalid: { raw: string; reason: string }[];
  duplicates: number;
}

export function analyzeNumbers(entries: string[], countryCode: string): NumberAnalysis {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: { raw: string; reason: string }[] = [];
  let duplicates = 0;

  for (const raw of entries) {
    const result = normalizeBroadcastNumber(raw, countryCode);
    if (!result.ok) {
      invalid.push({ raw, reason: result.reason });
    } else if (seen.has(result.phone)) {
      duplicates += 1;
    } else {
      seen.add(result.phone);
      valid.push(result.phone);
    }
  }

  return { total: entries.length, valid, invalid, duplicates };
}
