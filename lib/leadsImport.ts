// Lead import — field mapping & validation

import {
  cell,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  parseNumber,
  parseTags,
  summarize,
  type ColumnMapping,
  type ImportField,
  type RawRow,
  type ValidatedRow,
  type ValidationSummary,
} from "@/lib/import";

export {
  IMPORT_MAX_ROWS,
  autoMapHeaders,
  type ColumnMapping,
  type ImportResult,
} from "@/lib/import";

export const LEAD_IMPORT_FIELDS: ImportField[] = [
  { key: "title", label: "Lead Name", aliases: ["lead name", "title", "lead", "deal", "opportunity", "deal name", "name"] },
  {
    key: "phone",
    label: "Phone",
    required: true,
    aliases: ["phone", "phone number", "phonenumber", "mobile", "mobile number", "whatsapp", "whatsapp number", "number", "contact number", "msisdn", "cell"],
  },
  { key: "email", label: "Email", aliases: ["email", "email address", "e-mail", "mail"] },
  { key: "company", label: "Company", aliases: ["company", "organization", "organisation", "business", "company name", "org"] },
  { key: "assignee", label: "Assigned To", aliases: ["assigned to", "assignee", "owner", "agent", "sales rep", "rep", "assigned"] },
  { key: "stage", label: "Stage", aliases: ["stage", "pipeline stage", "lead stage", "status"] },
  { key: "source", label: "Source", aliases: ["source", "lead source", "channel"] },
  { key: "value", label: "Value", aliases: ["value", "deal value", "amount", "deal size", "revenue", "price"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "remark", "remarks", "comment", "comments"] },
  { key: "tags", label: "Tags", aliases: ["tags", "tag", "labels", "label"] },
];

export interface ImportLeadPayload {
  title?: string;
  phone: string;
  email?: string;
  company?: string;
  source?: string;
  value?: number;
  notes?: string;
  tags?: string[];
  stageName?: string;
  assignee?: string;
}

export interface LeadImportContext {
  stageNames: string[];
  users: { id: string; name?: string | null; email: string }[];
}

export function validateLeadRows(
  rawRows: RawRow[],
  mapping: ColumnMapping,
  ctx: LeadImportContext,
): ValidationSummary<ImportLeadPayload> {
  const stageByName = new Map(ctx.stageNames.map((n) => [n.toLowerCase(), n]));
  const userKeys = new Set<string>();
  for (const u of ctx.users) {
    if (u.email) userKeys.add(u.email.toLowerCase());
    if (u.name) userKeys.add(u.name.toLowerCase());
  }

  const seenPhones = new Set<string>();
  const rows: ValidatedRow<ImportLeadPayload>[] = [];

  rawRows.forEach((raw, index) => {
    const title = cell(raw, mapping.title);
    const rawPhone = cell(raw, mapping.phone);
    const email = cell(raw, mapping.email);
    const stage = cell(raw, mapping.stage);
    const assignee = cell(raw, mapping.assignee);
    const valueCell = cell(raw, mapping.value);
    const phone = normalizePhone(rawPhone);

    const isEmpty = [
      title, rawPhone, email, stage, assignee, valueCell,
      cell(raw, mapping.company), cell(raw, mapping.source), cell(raw, mapping.notes), cell(raw, mapping.tags),
    ].every((v) => v.length === 0);

    const errors: string[] = [];
    if (!isEmpty) {
      if (!rawPhone) errors.push("Phone is required");
      else if (!isValidPhone(phone)) errors.push("Invalid phone number");
      if (email && !isValidEmail(email)) errors.push("Invalid email address");
      if (stage && !stageByName.has(stage.toLowerCase())) errors.push(`Unknown stage "${stage}"`);
      if (assignee && !userKeys.has(assignee.toLowerCase())) errors.push(`Unknown user "${assignee}"`);
      if (valueCell && parseNumber(valueCell) === undefined) errors.push("Invalid value");
    }

    const isDuplicateInFile = !isEmpty && phone.length > 0 && seenPhones.has(phone);
    if (phone.length > 0 && isValidPhone(phone)) seenPhones.add(phone);

    const payload: ImportLeadPayload = {
      title: title || undefined,
      phone,
      email: email || undefined,
      company: cell(raw, mapping.company) || undefined,
      source: cell(raw, mapping.source) || undefined,
      value: parseNumber(valueCell),
      notes: cell(raw, mapping.notes) || undefined,
      tags: parseTags(cell(raw, mapping.tags)),
      stageName: stage || undefined,
      assignee: assignee || undefined,
    };

    rows.push({
      index,
      payload,
      display: { primary: payload.title || payload.phone || "—", secondary: phone || undefined },
      errors,
      isEmpty,
      isDuplicateInFile,
      isValid: !isEmpty && errors.length === 0 && !isDuplicateInFile,
    });
  });

  return summarize(rows);
}
