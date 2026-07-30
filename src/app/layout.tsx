import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const siteDescription =
  "Capture what you earned. Protect what you bill. Free Chart Scan for home health — submission readiness, dual dollar paths, CMS-anchored Clinical Revenue Integrity.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "Upheld — Clinical Revenue Integrity for Home Health",
    template: "%s · Upheld",
  },
  description: siteDescription,
  applicationName: "Upheld",
  keywords: [
    "home health",
    "PDGM",
    "LUPA",
    "clinical revenue integrity",
    "OASIS",
    "chart review",
    "Medicare home health",
  ],
  authors: [{ name: "Humble Haus Ventures" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Upheld",
    title: "Upheld — Clinical Revenue Integrity",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Upheld — Clinical Revenue Integrity",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
