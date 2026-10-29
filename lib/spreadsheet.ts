"use client";

// Spreadsheet parsing (client-only)
// The one place the app reads .xlsx / .xls / .csv files.

import * as XLSX from "xlsx";
import type { RawRow } from "@/lib/import";

export interface ParsedSheet {
  headers: string[];
  rows: RawRow[];
}

export interface Workbook {
  sheetNames: string[];
  parse: (sheetName: string) => ParsedSheet;
}

export async function loadWorkbook(file: File): Promise<Workbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  return {
    sheetNames: wb.SheetNames,
    parse: (sheetName) => parseSheet(wb.Sheets[sheetName]),
  };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const wb = await loadWorkbook(file);
  return wb.sheetNames[0] ? wb.parse(wb.sheetNames[0]) : { headers: [], rows: [] };
}

function parseSheet(sheet: XLSX.WorkSheet | undefined): ParsedSheet {
  if (!sheet) return { headers: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (matrix.length === 0) return { headers: [], rows: [] };

  const seen = new Map<string, number>();
  const headers = (matrix[0] as unknown[]).map((h, i) => {
    let name = String(h ?? "").trim() || `Column ${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name} (${count + 1})`;
    return name;
  });

  const rows: RawRow[] = matrix.slice(1).map((r) => {
    const arr = r as unknown[];
    const obj: RawRow = {};
    headers.forEach((h, i) => (obj[h] = arr[i] ?? ""));
    return obj;
  });

  return { headers, rows };
}
