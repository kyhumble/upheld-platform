"use client";

import { useState } from "react";

export function CopyBoardButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm hover:bg-mist"
    >
      {copied ? "Copied" : "Copy board read-out"}
    </button>
  );
}
