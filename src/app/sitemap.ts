import type { MetadataRoute } from "next";

function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://upheld-platform.vercel.app";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/scan`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${base}/trust`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/calculations`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${base}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${base}/pilot`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    // invite links are private tokens — not listed
    { url: `${base}/pilot/success`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
