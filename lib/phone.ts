/**
 * Phone numbers are stored as bare digits — the form WhatsApp itself uses, since a
 * webhook's `wa_id` has no `+`. The `+` belongs to display only.
 *
 * Every screen used to add it with `+{contact.phone}`, which was right for a webhook-made
 * contact and wrong for one added through the dashboard's phone field, where the value
 * already began with `+`. Those read `++919589708682`. Normalising first makes the display
 * correct whichever spelling a row still holds.
 */

/** Digits only, `+` and separators removed, a leading international `00` dropped. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

/** For display: exactly one `+`, whatever the stored value looked like. */
export function displayPhone(raw: string | null | undefined): string {
  const digits = normalizePhone(raw);
  return digits ? `+${digits}` : "";
}
