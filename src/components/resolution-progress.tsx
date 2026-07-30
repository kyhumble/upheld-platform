import Link from "next/link";
import { Card, CardHeader } from "./ui";

export function ResolutionProgress({
  open,
  resolved,
  dismissed,
}: {
  open: number;
  resolved: number;
  dismissed: number;
}) {
  const total = open + resolved + dismissed;
  if (total === 0) return null;
  const closed = resolved + dismissed;
  const pct = Math.round((closed / total) * 100);
  const openPct = Math.round((open / total) * 100);
  const resPct = Math.round((resolved / total) * 100);
  const disPct = Math.max(0, 100 - openPct - resPct);

  return (
    <Card>
      <CardHeader
        title="Human review progress"
        subtitle={`${closed} of ${total} findings addressed (${pct}%)`}
        action={
          <Link href="/issues" className="text-xs font-semibold text-teal hover:underline">
            All issues →
          </Link>
        }
      />
      <div className="px-5 py-4">
        <Link
          href="/issues"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
          title="Open issues worklist"
        >
          <div className="flex h-3 overflow-hidden rounded-full bg-mist transition hover:opacity-90">
            <div className="bg-ok transition-all" style={{ width: `${resPct}%` }} title="Resolved" />
            <div
              className="bg-navy/40 transition-all"
              style={{ width: `${disPct}%` }}
              title="Dismissed"
            />
            <div
              className="bg-warn/80 transition-all"
              style={{ width: `${openPct}%` }}
              title="Open"
            />
          </div>
        </Link>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <Link
            href="/issues?status=RESOLVED"
            className="font-medium text-muted hover:text-ok hover:underline"
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ok" />
            Resolved {resolved}
          </Link>
          <Link
            href="/issues?status=DISMISSED"
            className="font-medium text-muted hover:text-navy hover:underline"
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-navy/40" />
            Dismissed {dismissed}
          </Link>
          <Link href="/issues" className="font-medium text-muted hover:text-warn hover:underline">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-warn" />
            Open {open}
          </Link>
        </div>
      </div>
    </Card>
  );
}
