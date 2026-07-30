import type { ChartDocument } from "@prisma/client";
import { Badge, Card, CardHeader } from "./ui";

export function DocumentsPanel({ documents }: { documents: ChartDocument[] }) {
  if (!documents.length) return null;

  return (
    <Card>
      <CardHeader
        title="Documents analyzed"
        subtitle={`${documents.length} artifact${documents.length === 1 ? "" : "s"} in this episode packet`}
      />
      <div className="divide-y divide-border">
        {documents.map((d) => {
          let meta: { documentTypesDetected?: string[]; warnings?: string[] } = {};
          try {
            meta = JSON.parse(d.metaJson) as typeof meta;
          } catch {
            meta = {};
          }
          const chars = d.extractedText?.length ?? 0;
          return (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-navy">{d.fileName}</p>
                <p className="text-xs text-muted">
                  {d.mimeType || "unknown"} · {(d.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                  {chars.toLocaleString()} chars extracted
                </p>
                {meta.warnings?.length ? (
                  <p className="mt-1 text-[11px] text-warn">{meta.warnings[0]}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge tone="navy">{d.documentType}</Badge>
                {(meta.documentTypesDetected ?? []).slice(0, 3).map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
