"use client";

import { useActionState, useState } from "react";
import {
  requestPilotFromScanAction,
  type AgencyActionState,
} from "@/server/actions/agency";
import { Button, Input, Label, Textarea } from "./ui";
import { PilotCheckoutButton } from "./pilot-checkout-button";

const initial: AgencyActionState = {};

export function PilotCtaForm({
  token,
  defaultEmail,
  defaultName,
  defaultAgency,
  stripeEnabled = false,
}: {
  token: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
  defaultAgency?: string | null;
  stripeEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(requestPilotFromScanAction, initial);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [agencyName, setAgencyName] = useState(defaultAgency ?? "");
  const [note, setNote] = useState("");

  if (state.ok) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-white">
        <p className="font-semibold">Pilot interest received.</p>
        <p className="mt-1 text-white/75">
          We&apos;ll follow up at your email. You can also reach us at ky@getupheld.com.
        </p>
        {stripeEnabled && email ? (
          <div className="mt-4">
            <PilotCheckoutButton
              email={email}
              name={name}
              agencyName={agencyName}
              scanToken={token}
              note={note}
              source="scan_report_after_interest"
              label="Or pay now to reserve pilot"
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="no-print space-y-3 rounded-xl border border-white/15 bg-white/5 p-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm font-medium text-white">Start a 30-day pilot from this proof</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="pilot-name">Name</Label>
          <Input
            id="pilot-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="!bg-white"
            disabled={pending}
          />
        </div>
        <div>
          <Label htmlFor="pilot-email">Email</Label>
          <Input
            id="pilot-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="!bg-white"
            disabled={pending}
          />
        </div>
        <div>
          <Label htmlFor="pilot-agency">Agency</Label>
          <Input
            id="pilot-agency"
            name="agencyName"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className="!bg-white"
            disabled={pending}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="pilot-note">Success metric (optional)</Label>
        <Textarea
          id="pilot-note"
          name="note"
          rows={2}
          placeholder="What would make this pilot a clear win?"
          className="!bg-white"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="!bg-white !text-navy hover:!bg-white/90">
          {pending ? "Sending…" : "Request pilot"}
        </Button>
        {stripeEnabled ? (
          <PilotCheckoutButton
            email={email}
            name={name}
            agencyName={agencyName}
            scanToken={token}
            note={note}
            source="scan_report_pay"
          />
        ) : null}
      </div>
      {state.error ? <p className="text-xs text-red-200">{state.error}</p> : null}
    </form>
  );
}
