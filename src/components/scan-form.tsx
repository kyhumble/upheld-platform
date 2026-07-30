"use client";

import { useActionState, useState } from "react";
import {
  createScanFromTextAction,
  createScanFromUploadAction,
  type CreateScanState,
} from "@/server/actions/scans";
import { Button, Card, Input, Label, Textarea } from "./ui";
import { PageEnter } from "./site-motion";

const initial: CreateScanState = {};

export function ScanForm({
  isAuthenticated,
  defaultEmail = "",
  defaultName = "",
  defaultAgency = "",
}: {
  isAuthenticated: boolean;
  defaultEmail?: string;
  defaultName?: string;
  defaultAgency?: string;
}) {
  const [contactName, setContactName] = useState(defaultName);
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [agencyNameHint, setAgencyNameHint] = useState(defaultAgency);

  const [textState, textAction, textPending] = useActionState(createScanFromTextAction, initial);
  const [uploadState, uploadAction, uploadPending] = useActionState(
    createScanFromUploadAction,
    initial,
  );

  const pending = textPending || uploadPending;
  const error = textState.error || uploadState.error;

  const analyzingOverlay = pending ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
          Free Chart Scan
        </p>
        <h2 className="mt-2 text-lg font-semibold text-navy">Running multi-pass analysis…</h2>
        <ol className="mt-4 space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="font-mono text-teal">01</span> Ingest packet / extract text
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-teal">02</span> Clinical · Compliance · Revenue passes
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-teal">03</span> LUPA model · score capture + protect $
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-teal">04</span> Build interactive report
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted">
          Usually a few seconds for text packets. Please keep this tab open.
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-mist">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-teal" />
        </div>
      </div>
    </div>
  ) : null;

  const contactFields = (
    <>
      <input type="hidden" name="contactName" value={contactName} />
      <input type="hidden" name="contactEmail" value={contactEmail} />
      <input type="hidden" name="agencyNameHint" value={agencyNameHint} />
    </>
  );

  return (
    <div className="space-y-6">
      {analyzingOverlay}
      {error ? (
        <div className="rounded-lg border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <PageEnter>
        <div className="rounded-xl border border-teal/25 bg-gradient-to-r from-teal/10 to-white px-4 py-3 text-sm text-navy shadow-sm">
          <p className="font-semibold">What you get</p>
          <p className="mt-1 text-muted">
            Submission readiness (0–100), the{" "}
            <span className="font-semibold text-navy">expected 30-day period total</span> (CMS
            national base), <span className="font-semibold text-ok">capture $</span> if docs are
            fixed, and <span className="font-semibold text-danger">protect $</span> at risk if
            submitted as-is.
          </p>
        </div>
      </PageEnter>

      <PageEnter delay={1}>
      <Card className="p-6" hover>
        <h2 className="text-base font-semibold text-navy">1 · Who should receive this report?</h2>
        <p className="mt-1 text-sm text-muted">
          Free scans expire after retention days. Prefer de-identified charts until a BAA is signed.
          Rate-limited to prevent abuse.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="contactName">Your name</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jordan Miles"
              disabled={pending}
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Work email {!isAuthenticated ? "*" : ""}</Label>
            <Input
              id="contactEmail"
              type="email"
              required={!isAuthenticated}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="qa@agency.com"
              disabled={pending}
            />
          </div>
          <div>
            <Label htmlFor="agencyNameHint">Agency</Label>
            <Input
              id="agencyNameHint"
              value={agencyNameHint}
              onChange={(e) => setAgencyNameHint(e.target.value)}
              placeholder="Summit Home Health"
              disabled={pending}
            />
          </div>
        </div>
      </Card>
      </PageEnter>

      <div className="grid gap-6 lg:grid-cols-2">
        <PageEnter delay={2}>
        <Card className="h-full p-6" hover>
          <h2 className="text-base font-semibold text-navy">2 · Upload episode packet</h2>
          <p className="mt-1 text-sm text-muted">
            PDF, ZIP, or text · max 10 MB. Text-layer PDFs extract immediately; scanned/image PDFs
            use OCR when available (Azure Document Intelligence).
          </p>
          <form action={uploadAction} className="mt-4 space-y-4">
            {contactFields}
            <div>
              <Label htmlFor="file">Chart file</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.zip,.txt,.md,.csv,text/plain,application/pdf,application/zip"
                disabled={pending}
                required
              />
            </div>
            <div>
              <Label htmlFor="chartTextUpload">Paste fallback (if PDF is image-only)</Label>
              <Textarea
                id="chartTextUpload"
                name="chartText"
                rows={5}
                placeholder="Optional: paste OASIS + notes if extraction is thin…"
                disabled={pending}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="sendEmail" value="1" defaultChecked disabled={pending} />
              Email report link when complete
            </label>
            <Button type="submit" disabled={pending} className="mkt-btn-glow w-full sm:w-auto">
              {uploadPending ? "Analyzing…" : "Run Free Chart Scan"}
            </Button>
          </form>
        </Card>
        </PageEnter>

        <PageEnter delay={3}>
        <Card className="h-full p-6" hover>
          <h2 className="text-base font-semibold text-navy">Or paste chart text</h2>
          <p className="mt-1 text-sm text-muted">
            Multi-pass Clinical · Compliance · Revenue — readiness, capture $, and protect $.
          </p>
          <form action={textAction} className="mt-4 space-y-4">
            {contactFields}
            <div>
              <Label htmlFor="chartText">Episode text</Label>
              <Textarea
                id="chartText"
                name="chartText"
                rows={12}
                placeholder="Paste OASIS, orders, F2F, visit notes…"
                disabled={pending}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="sendEmail" value="1" defaultChecked disabled={pending} />
              Email report link when complete
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending} className="mkt-btn-glow">
                {textPending ? "Analyzing…" : "Analyze pasted chart"}
              </Button>
              <Button
                type="submit"
                name="useSample"
                value="at-risk"
                variant="secondary"
                disabled={pending}
              >
                Sample: at-risk episode
              </Button>
              <Button
                type="submit"
                name="useSample"
                value="strong"
                variant="secondary"
                disabled={pending}
              >
                Sample: strong docs
              </Button>
            </div>
          </form>
        </Card>
        </PageEnter>
      </div>

      <p className="text-center text-xs text-muted">
        CMS CY 2026 national 30-day base $2,038.22 · Human review required · Not for production PHI
        without BAA
      </p>
    </div>
  );
}
