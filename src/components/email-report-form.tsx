"use client";

import { useActionState } from "react";
import {
  emailScanReportAction,
  type EmailScanState,
} from "@/server/actions/scans";
import { Button, Input, Label } from "./ui";

const initial: EmailScanState = {};

export function EmailReportForm({
  token,
  defaultEmail,
}: {
  token: string;
  defaultEmail?: string | null;
}) {
  const [state, action, pending] = useActionState(emailScanReportAction, initial);

  return (
    <form action={action} className="no-print flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <input type="hidden" name="token" value={token} />
      <div className="min-w-[220px] flex-1">
        <Label htmlFor="email-report">Email this report</Label>
        <Input
          id="email-report"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder="qa@agency.com"
          disabled={pending}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send report link"}
      </Button>
      {state.ok ? (
        <p className="w-full text-xs text-ok">
          Sent{state.mode === "log" ? " (dev log — set RESEND_API_KEY for live email)" : ""}.
        </p>
      ) : null}
      {state.error ? <p className="w-full text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
