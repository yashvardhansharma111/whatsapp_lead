// Blacklist checks run in NestJS — this stub satisfies lib/whatsapp.ts imports in Next.js.
export async function blacklistReasonFor(
  _phoneNumberId: string,
  _to: string,
): Promise<{ scope: "account" | "platform" } | null> {
  return null;
}
