"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm"
    >
      Print / PDF
    </button>
  );
}
