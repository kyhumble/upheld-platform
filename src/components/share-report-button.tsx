"use client";

import { useState } from "react";

export function ShareReportButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/scan/${token}`
        : `/scan/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      window.prompt("Copy report link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="no-print rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm hover:bg-mist"
    >
      {copied ? "Link copied" : "Copy share link"}
    </button>
  );
}
