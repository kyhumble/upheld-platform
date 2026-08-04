"use client";

import { useActionState, useMemo, useState } from "react";
import type { ChartFinding } from "@prisma/client";
import {
  sendToFieldNurseAction,
  type FieldHandoffState,
} from "@/server/actions/scans";
import { Button, Card, Input, Label, Textarea } from "./ui";
import { formatCurrency } from "@/lib/utils";

const initial: FieldHandoffState = {};

/**
 * QA / reviewer → field nurse: email open findings as a correction task list.
 */
export function SendToFieldForm({
  scanToken,
  findings,
  defaultNurseName = "",
  defaultNurseEmail = "",
}: {
  scanToken: string;
  findings: ChartFinding[];
  defaultNurseName?: string;
  defaultNurseEmail?: string;
}) {
  const openFindings = useMemo(
    () => findings.filter((f) => f.status === "OPEN"),
    [findings],
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(openFindings.map((f) => f.id)),
  );
  const [nurseName, setNurseName] = useState(defaultNurseName);
  const [nurseEmail, setNurseEmail] = useState(defaultNurseEmail);
  const [state, action, pending] = useActionState(sendToFieldNurseAction, initial);

  if (openFindings.length === 0) {
    return (
      <Card className="no-print p-5">
        <h2 className="text-base font-semibold text-navy">Send to field nurse</h2>
        <p className="mt-2 text-sm text-muted">
          No open findings to send — everything is resolved or dismissed.
        </p>
      </Card>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(openFindings.map((f) => f.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  if (state.ok) {
    return (
      <Card className="no-print border-ok/30 bg-emerald-50/50 p-5">
        <h2 className="text-base font-semibold text-navy">Sent to field nurse</h2>
        <p className="mt-2 text-sm text-muted">
          Correction list ({state.sentCount ?? selected.size} item
          {(state.sentCount ?? selected.size) === 1 ? "" : "s"}) emailed to{" "}
          <strong className="text-navy">{nurseEmail}</strong>. They can open the full report from
          the email and reply when the chart is updated.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Send another
        </Button>
      </Card>
    );
  }

  return (
    <Card className="no-print border-teal/25 p-5" hover>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
            Field handoff
          </p>
          <h2 className="mt-1 text-base font-semibold text-navy">Send to field nurse</h2>
          <p className="mt-1 text-sm text-muted">
            Email selected open findings so the assessing nurse can correct the chart before
            submission. Includes suggested fixes and a link to this report.
          </p>
        </div>
      </div>

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="scanToken" value={scanToken} />
        <input type="hidden" name="findingIds" value={[...selected].join(",")} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nurseName">Nurse name</Label>
            <Input
              id="nurseName"
              name="nurseName"
              value={nurseName}
              onChange={(e) => setNurseName(e.target.value)}
              placeholder="Sam Rivera, RN"
              disabled={pending}
            />
          </div>
          <div>
            <Label htmlFor="nurseEmail">Nurse email *</Label>
            <Input
              id="nurseEmail"
              name="nurseEmail"
              type="email"
              required
              value={nurseEmail}
              onChange={(e) => setNurseEmail(e.target.value)}
              placeholder="nurse@agency.com"
              disabled={pending}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="qaNote">Note to nurse (optional)</Label>
          <Textarea
            id="qaNote"
            name="qaNote"
            rows={2}
            placeholder="e.g. Please complete F2F and homebound narrative before Friday noon."
            disabled={pending}
          />
        </div>

        <div className="rounded-xl border border-border bg-paper p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-navy">
              Open findings to include ({selected.size} of {openFindings.length})
            </p>
            <div className="flex gap-2 text-xs font-semibold">
              <button
                type="button"
                className="text-teal hover:underline"
                onClick={selectAll}
                disabled={pending}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-muted hover:underline"
                onClick={selectNone}
                disabled={pending}
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {openFindings.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:border-teal/30">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    disabled={pending}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-navy">{f.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {f.severity} · {f.module}
                      {f.estimatedImpact != null && f.estimatedImpact > 0
                        ? ` · ${formatCurrency(f.estimatedImpact)}`
                        : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <Button
          type="submit"
          disabled={pending || selected.size === 0 || !nurseEmail.trim()}
          className="mkt-btn-glow"
        >
          {pending
            ? "Sending…"
            : `Email ${selected.size} item${selected.size === 1 ? "" : "s"} to nurse`}
        </Button>
        {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
        <p className="text-[11px] text-muted">
          Nurse receives a plain-language fix list. Reply-to is your account email when signed in,
          so they can respond to QA directly.
        </p>
      </form>
    </Card>
  );
}
