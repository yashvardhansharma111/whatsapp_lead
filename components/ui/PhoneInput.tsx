"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ── Country data ──────────────────────────────────────────────────────────────

export interface Country {
  code: string;
  dial: string;
  flag: string;
  name: string;
}

/** Top-50 countries by WhatsApp user count, India first. */
export const COUNTRIES: Country[] = [
  { code: "IN", dial: "91",  flag: "🇮🇳", name: "India" },
  { code: "US", dial: "1",   flag: "🇺🇸", name: "United States" },
  { code: "BR", dial: "55",  flag: "🇧🇷", name: "Brazil" },
  { code: "ID", dial: "62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "NG", dial: "234", flag: "🇳🇬", name: "Nigeria" },
  { code: "MX", dial: "52",  flag: "🇲🇽", name: "Mexico" },
  { code: "PK", dial: "92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "BD", dial: "880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "RU", dial: "7",   flag: "🇷🇺", name: "Russia" },
  { code: "DE", dial: "49",  flag: "🇩🇪", name: "Germany" },
  { code: "GB", dial: "44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "FR", dial: "33",  flag: "🇫🇷", name: "France" },
  { code: "IT", dial: "39",  flag: "🇮🇹", name: "Italy" },
  { code: "ES", dial: "34",  flag: "🇪🇸", name: "Spain" },
  { code: "AR", dial: "54",  flag: "🇦🇷", name: "Argentina" },
  { code: "CO", dial: "57",  flag: "🇨🇴", name: "Colombia" },
  { code: "TR", dial: "90",  flag: "🇹🇷", name: "Turkey" },
  { code: "PH", dial: "63",  flag: "🇵🇭", name: "Philippines" },
  { code: "EG", dial: "20",  flag: "🇪🇬", name: "Egypt" },
  { code: "SA", dial: "966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "AE", dial: "971", flag: "🇦🇪", name: "UAE" },
  { code: "ZA", dial: "27",  flag: "🇿🇦", name: "South Africa" },
  { code: "KE", dial: "254", flag: "🇰🇪", name: "Kenya" },
  { code: "GH", dial: "233", flag: "🇬🇭", name: "Ghana" },
  { code: "TZ", dial: "255", flag: "🇹🇿", name: "Tanzania" },
  { code: "ET", dial: "251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "MA", dial: "212", flag: "🇲🇦", name: "Morocco" },
  { code: "DZ", dial: "213", flag: "🇩🇿", name: "Algeria" },
  { code: "IQ", dial: "964", flag: "🇮🇶", name: "Iraq" },
  { code: "IR", dial: "98",  flag: "🇮🇷", name: "Iran" },
  { code: "TH", dial: "66",  flag: "🇹🇭", name: "Thailand" },
  { code: "VN", dial: "84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "MY", dial: "60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "SG", dial: "65",  flag: "🇸🇬", name: "Singapore" },
  { code: "LK", dial: "94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "NP", dial: "977", flag: "🇳🇵", name: "Nepal" },
  { code: "MM", dial: "95",  flag: "🇲🇲", name: "Myanmar" },
  { code: "KH", dial: "855", flag: "🇰🇭", name: "Cambodia" },
  { code: "PL", dial: "48",  flag: "🇵🇱", name: "Poland" },
  { code: "UA", dial: "380", flag: "🇺🇦", name: "Ukraine" },
  { code: "CA", dial: "1",   flag: "🇨🇦", name: "Canada (+1)" },
  { code: "AU", dial: "61",  flag: "🇦🇺", name: "Australia" },
  { code: "NZ", dial: "64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "JP", dial: "81",  flag: "🇯🇵", name: "Japan" },
  { code: "KR", dial: "82",  flag: "🇰🇷", name: "South Korea" },
  { code: "CN", dial: "86",  flag: "🇨🇳", name: "China" },
  { code: "HK", dial: "852", flag: "🇭🇰", name: "Hong Kong" },
  { code: "PT", dial: "351", flag: "🇵🇹", name: "Portugal" },
  { code: "PE", dial: "51",  flag: "🇵🇪", name: "Peru" },
  { code: "CL", dial: "56",  flag: "🇨🇱", name: "Chile" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectCountry(e164: string): Country {
  if (!e164.startsWith("+")) return COUNTRIES[0];
  const digits = e164.slice(1);
  // Try longest dial match first (3-digit, then 2-digit, then 1-digit)
  for (const len of [3, 2, 1]) {
    const prefix = digits.slice(0, len);
    const match = COUNTRIES.find((c) => c.dial === prefix);
    if (match) return match;
  }
  return COUNTRIES[0];
}

function stripDialCode(e164: string, dial: string): string {
  if (e164.startsWith(`+${dial}`)) return e164.slice(1 + dial.length).replace(/^\s+/, "");
  if (e164.startsWith("+")) return e164.slice(1 + dial.length).replace(/^\s+/, "");
  return e164;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  disabled?: boolean;
  error?: boolean;
}

/**
 * Country-code selector + national number input.
 * Produces and accepts full E.164 strings: "+919876543210".
 */
export function PhoneInput({
  value = "",
  onChange,
  onBlur,
  id,
  disabled,
  error,
}: PhoneInputProps) {
  const [country, setCountry] = useState<Country>(() => detectCountry(value));
  const [local, setLocal] = useState(() => stripDialCode(value, detectCountry(value).dial));
  const prevValue = useRef(value);

  // Sync if the parent changes the value externally (e.g. form reset)
  useEffect(() => {
    if (value !== prevValue.current) {
      const c = detectCountry(value);
      setCountry(c);
      setLocal(stripDialCode(value, c.dial));
      prevValue.current = value;
    }
  }, [value]);

  function handleCountryChange(code: string) {
    const c = COUNTRIES.find((x) => x.code === code) ?? COUNTRIES[0];
    setCountry(c);
    const next = local.trim() ? `+${c.dial}${local.replace(/\D/g, "")}` : "";
    prevValue.current = next;
    onChange?.(next);
  }

  function handleLocalChange(raw: string) {
    const digits = raw.replace(/[^\d\s\-()]/g, "");
    setLocal(digits);
    const clean = digits.replace(/\D/g, "");
    const next = clean ? `+${country.dial}${clean}` : "";
    prevValue.current = next;
    onChange?.(next);
  }

  const borderClass = error
    ? "ring-rose-300 focus-within:ring-rose-400"
    : "ring-slate-200 focus-within:ring-emerald-400";

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg bg-white shadow-sm ring-1 transition",
        borderClass,
        disabled && "opacity-60",
      )}
    >
      <select
        value={country.code}
        onChange={(e) => handleCountryChange(e.target.value)}
        disabled={disabled}
        aria-label="Country code"
        className="shrink-0 border-r border-slate-200 bg-transparent py-2 pl-2.5 pr-1 text-sm text-slate-700 outline-none focus:outline-none"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="98765 43210"
        autoComplete="tel-national"
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
      />
    </div>
  );
}
