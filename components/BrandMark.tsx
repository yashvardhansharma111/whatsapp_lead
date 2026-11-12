// The brand's mark: its logo, or its initials.
//
// Written separately in three places — the app sidebar, the sign-in page and the admin
// panel — and each fell back to a chat bubble, so any brand without an uploaded logo was
// represented by a picture of a message. That is a drawing of what the product does, not
// a mark for whoever is running it, and on a white-label reseller's own domain it is
// someone else's idea of their brand.
//
// Initials instead. They are always right, they are never anybody else's, and they say
// plainly that a logo is waiting to be uploaded.

/**
 * One or two letters for a name: the first letter of the first two words, or the first
 * two letters of a single word. "Waboxa" → WA, "Acme Retail" → AR.
 */
export function brandInitials(name: string): string {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function BrandMark({
  name,
  logoUrl,
  className,
  color,
  textClassName,
}: {
  name: string;
  logoUrl?: string | null;
  /** Size, radius and any ring. The caller owns the shape. */
  className: string;
  /** The square's colour behind the initials. Ignored once a logo is set. */
  color?: string;
  /** Overrides the colour of the initials, for a mark sitting on a dark panel. */
  textClassName?: string;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- an arbitrary URL the brand set
    return <img src={logoUrl} alt="" className={`${className} object-contain`} />;
  }
  return (
    <span
      aria-hidden
      className={`${className} flex items-center justify-center font-bold tracking-tight ${textClassName ?? "text-white"}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      <span className="text-[0.4em] leading-none">{brandInitials(name)}</span>
    </span>
  );
}
