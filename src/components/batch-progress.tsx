"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * While a batch is PROCESSING, call /api/batch/[id]/process in a loop
 * until complete (chunked serverless-safe path for 100+ claims).
 */
export function BatchProgress({
  jobId,
  initialStatus,
  itemCount,
  processedCount: initialProcessed,
}: {
  jobId: string;
  initialStatus: string;
  itemCount: number;
  processedCount: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [processed, setProcessed] = useState(initialProcessed);
  const [pending, setPending] = useState(
    Math.max(0, itemCount - initialProcessed),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (initialStatus === "COMPLETE" || initialStatus === "FAILED") return;
    let cancelled = false;

    async function tick() {
      if (running.current || cancelled) return;
      running.current = true;
      setBusy(true);
      try {
        const res = await fetch(`/api/batch/${jobId}/process`, { method: "POST" });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          complete?: boolean;
          status?: string;
          processedCount?: number;
          pendingRemaining?: number;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Process failed");
          setStatus("FAILED");
          return;
        }
        setStatus(data.status ?? "PROCESSING");
        setProcessed(data.processedCount ?? 0);
        setPending(data.pendingRemaining ?? 0);
        if (data.complete) {
          router.refresh();
          return;
        }
        // continue next chunk
        running.current = false;
        setBusy(false);
        if (!cancelled) {
          // small yield so UI paints
          setTimeout(() => {
            void tick();
          }, 50);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        setStatus("FAILED");
      } finally {
        running.current = false;
        setBusy(false);
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [jobId, initialStatus, router]);

  if (status === "COMPLETE" && !error) return null;

  const pct =
    itemCount > 0 ? Math.min(100, Math.round((processed / itemCount) * 100)) : 0;

  return (
    <div className="rounded-xl border border-teal/30 bg-teal/5 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">
          {status === "FAILED"
            ? "Batch failed"
            : busy || status === "PROCESSING"
              ? "Analyzing claims (chunked)…"
              : status}
        </p>
        <p className="text-xs tabular-nums text-muted">
          {processed} / {itemCount} · {pending} pending · {pct}%
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-teal transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Large cohorts process in small chunks so serverless time limits never drop the job. Leave
        this tab open until complete.
      </p>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
