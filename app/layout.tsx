import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Static on purpose: reading the request host here would make every page — the
// marketing site included — render dynamically. Brand-by-domain lives in the
// (auth) layout (login/sign-up on a white-label domain) and the dashboard layout.
export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_BRAND_NAME ?? "Waboxa"} — AI-Powered WhatsApp CRM & Lead Management`,
  description:
    "Shared WhatsApp inbox, AI lead qualification, campaigns and analytics for sales teams.",
  manifest: "/manifest.webmanifest",
  // Declared once, here, so every page in every route group asks for the same two URLs.
  // Both are route handlers that answer per host, so this stays static while what they
  // return does not. The (auth) and (dashboard) layouts still set brand metadata for the
  // title and share image; they no longer need to repeat the icons.
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-white text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
