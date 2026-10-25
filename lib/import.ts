// Bulk import — generic primitives (isomorphic, no React/Prisma)
//
// The entity-agnostic core shared by every spreadsheet importer: column mapping,
// phone/email normalisation & checks, the validated-row shape the preview renders,
// and the request/result wire types.

import { z } from "zod";

export type ImportMode = "skip" | "update";

export const IMPORT_MAX_ROWS = 5000;

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export type ColumnMapping = Record<string, string | null>;
export type RawRow = Record<string, unknown>;

export const DEFAULT_COUNTRY_CODE = "91";

const NATIONAL_LENGTH: Record<string, number> = {
  "1": 10, "44": 10, "61": 9, "65": 8, "91": 10, "92": 10, "94": 9,
  "880": 10, "966": 9, "971": 9, "977": 10,
};

export function normalizePhone(raw: unknown, countryCode: string = DEFAULT_COUNTRY_CODE): string {
  const text = String(raw ?? "").trim();
  let digits = text.replace(/\D/g, "");
  if (!digits) return "";

  const international = text.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  const cc = countryCode.replace(/\D/g, "");
  if (!international && cc) {
    const national = digits.replace(/^0+/, "");
    const expected = NATIONAL_LENGTH[cc];
    if (expected ? national.length === expected : national.length <= 10) digits = cc + national;
  }
  return digits;
}

const emailSchema = z.string().email();

export function isValidPhone(digits: string): boolean {
  return /^[1-9]\d{9,14}$/.test(digits);
}

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function parseNumber(raw: unknown): number | undefined {
  const cleaned = String(raw ?? "").replace(/[^0-9.\-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function parseTags(raw: unknown): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;|]/)) {
    const name = part.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

export function autoMapHeaders(fields: ImportField[], headers: string[]): ColumnMapping {
  const norm = (s: string) => s.trim().toLowerCase();
  const used = new Set<string>();
  const mapping: ColumnMapping = {};
  for (const field of fields) {
    const match = headers.find(
      (h) => !used.has(h) && (norm(h) === field.key || field.aliases.includes(norm(h))),
    );
    mapping[field.key] = match ?? null;
    if (match) used.add(match);
  }
  return mapping;
}

export function cell(row: RawRow, header: string | null): string {
  if (!header) return "";
  const v = row[header];
  return v == null ? "" : String(v).trim();
}

export interface ValidatedRow<T> {
  index: number;
  payload: T;
  display: { primary: string; secondary?: string };
  errors: string[];
  isEmpty: boolean;
  isDuplicateInFile: boolean;
  isValid: boolean;
}

export interface ValidationSummary<T> {
  rows: ValidatedRow<T>[];
  total: number;
  valid: number;
  invalid: number;
  duplicateInFile: number;
  empty: number;
}

export function summarize<T>(rows: ValidatedRow<T>[]): ValidationSummary<T> {
  return {
    rows,
    total: rows.length,
    valid: rows.filter((r) => r.isValid).length,
    invalid: rows.filter((r) => !r.isEmpty && !r.isDuplicateInFile && r.errors.length > 0).length,
    duplicateInFile: rows.filter((r) => r.isDuplicateInFile).length,
    empty: rows.filter((r) => r.isEmpty).length,
  };
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  newCount?: number;
  existingCount?: number;
  errors: { ref?: string; reason: string }[];
}
