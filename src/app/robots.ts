import type { MetadataRoute } from "next";

function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://upheld-platform.vercel.app";
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scan", "/trust", "/calculations", "/sign-in", "/pilot/success", "/status"],
        disallow: [
          "/dashboard",
          "/scans",
          "/issues",
          "/clinicians",
          "/executive",
          "/activity",
          "/settings",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
