"use client";

import { useActionState } from "react";
import {
  requestPilotAction,
  updateAgencySettingsAction,
  type AgencyActionState,
} from "@/server/actions/agency";
import { Button, Input, Label, Textarea, Select } from "./ui";
import { PilotCheckoutButton } from "./pilot-checkout-button";

const initial: AgencyActionState = {};

export function AgencySettingsForm({
  agency,
  canEdit,
}: {
  agency: {
    name: string;
    npi: string | null;
    censusHint: number | null;
    wageIndex: number;
    baaStatus: string;
    billingEmail: string | null;
    phone: string | null;
  };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateAgencySettingsAction, initial);

  return (
    <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="name">Agency name</Label>
        <Input id="name" name="name" defaultValue={agency.name} required disabled={!canEdit || pending} />
      </div>
      <div>
        <Label htmlFor="npi">NPI</Label>
        <Input id="npi" name="npi" defaultValue={agency.npi ?? ""} disabled={!canEdit || pending} />
      </div>
      <div>
        <Label htmlFor="censusHint">Approx. ADC / census</Label>
        <Input
          id="censusHint"
          name="censusHint"
          type="number"
          min={0}
          defaultValue={agency.censusHint ?? ""}
          disabled={!canEdit || pending}
        />
      </div>
      <div>
        <Label htmlFor="wageIndex">Wage index (period $ model)</Label>
        <Input
          id="wageIndex"
          name="wageIndex"
          type="number"
          min={0.5}
          max={2}
          step={0.001}
          defaultValue={agency.wageIndex ?? 1}
          disabled={!canEdit || pending}
        />
        <p className="mt-1 text-[11px] text-muted">
          CBSA wage index for expected period payment. 1.000 = national. See{" "}
          <a href="/calculations" className="font-medium text-teal hover:underline">
            calculations
          </a>
          .
        </p>
      </div>
      <div>
        <Label htmlFor="baaStatus">BAA status</Label>
        <Select
          id="baaStatus"
          name="baaStatus"
          defaultValue={agency.baaStatus}
          disabled={!canEdit || pending}
        >
          <option value="none">None</option>
          <option value="pending">Pending</option>
          <option value="signed">Signed</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={agency.phone ?? ""} disabled={!canEdit || pending} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="billingEmail">Billing / ops email</Label>
        <Input
          id="billingEmail"
          name="billingEmail"
          type="email"
          defaultValue={agency.billingEmail ?? ""}
          disabled={!canEdit || pending}
        />
      </div>
      {canEdit ? (
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          {state.ok ? <p className="mt-2 text-xs text-ok">Saved.</p> : null}
          {state.error ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
        </div>
      ) : null}
    </form>
  );
}

export function PilotRequestForm({
  alreadyRequested,
  defaultNote,
  defaultEmail = "",
  defaultName = "",
  defaultAgency = "",
  stripeEnabled = false,
}: {
  alreadyRequested: boolean;
  defaultNote: string;
  defaultEmail?: string;
  defaultName?: string;
  defaultAgency?: string;
  stripeEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(requestPilotAction, initial);

  if (alreadyRequested && !state.ok) {
    return (
      <div className="space-y-2 text-sm text-muted">
        <p className="font-medium text-navy">Pilot interest is on file.</p>
        {defaultNote ? <p className="text-xs">Note: {defaultNote}</p> : null}
        <p className="text-xs">
          Our team will follow up at your account email. Or write{" "}
          <a className="font-medium text-teal" href="mailto:ky@getupheld.com?subject=Upheld%20pilot">
            ky@getupheld.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <form action={action} className="space-y-3">
        <p className="text-sm text-muted">
          30-day pilot: ongoing episode monitoring path, QA workflow, and success metric agreed in
          writing. Free Chart Scan stays the proof engine.
        </p>
        <div>
          <Label htmlFor="note">What do you want to prove in 30 days?</Label>
          <Textarea
            id="note"
            name="note"
            rows={3}
            placeholder="e.g. Reduce LUPA rate on one branch; catch F2F gaps before claim…"
            disabled={pending}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Request 30-day pilot"}
        </Button>
        {state.ok ? (
          <p className="text-xs text-ok">Interest recorded. We&apos;ll follow up shortly.</p>
        ) : null}
        {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      </form>
      {stripeEnabled && defaultEmail ? (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs text-muted">Or start paid checkout now:</p>
          <PilotCheckoutButton
            email={defaultEmail}
            name={defaultName}
            agencyName={defaultAgency}
            source="settings_pay"
            label="Pay to start 30-day pilot"
            className="[&_button]:!bg-navy [&_button]:!text-white"
          />
        </div>
      ) : null}
    </div>
  );
}
