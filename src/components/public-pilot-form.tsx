"use client";

import { useActionState, useState } from "react";
import {
  requestPublicPilotAction,
  type AgencyActionState,
} from "@/server/actions/agency";
import { Button, Input, Label, Textarea } from "./ui";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";

const initial: AgencyActionState = {};

/**
 * Public pilot request form — saves lead + emails ops (ky@getupheld.com) and the requester.
 */
export function PublicPilotForm({
  source = "public_pilot_form",
  defaultEmail = "",
  defaultName = "",
  defaultAgency = "",
  compact = false,
  variant = "light",
}: {
  source?: string;
  defaultEmail?: string;
  defaultName?: string;
  defaultAgency?: string;
  compact?: boolean;
  variant?: "light" | "dark" | "navy";
}) {
  const [state, action, pending] = useActionState(requestPublicPilotAction, initial);
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [agencyName, setAgencyName] = useState(defaultAgency);

  const isDark = variant === "dark" || variant === "navy";
  const shell =
    variant === "navy"
      ? "rounded-2xl border border-white/15 bg-white/10 p-5 text-white shadow-lg backdrop-blur-sm"
      : variant === "dark"
        ? "rounded-2xl border border-navy/20 bg-navy p-5 text-white shadow-lg"
        : "rounded-2xl border border-border bg-white p-5 shadow-sm";

  const labelClass = isDark ? "text-white/80" : undefined;
  const inputClass = isDark ? "!bg-white !text-navy" : undefined;

  if (state.ok) {
    return (
      <div className={shell}>
        <p className={`text-base font-semibold ${isDark ? "text-white" : "text-navy"}`}>
          Request received
        </p>
        <p className={`mt-2 text-sm ${isDark ? "text-white/75" : "text-muted"}`}>
          Thanks — we emailed a confirmation to{" "}
          <strong className={isDark ? "text-white" : "text-navy"}>{email || "you"}</strong>. Your
          request was also sent to our team at {CONTACT_EMAIL}. We&apos;ll follow up shortly.
        </p>
      </div>
    );
  }

  return (
    <div className={shell} id="request-pilot">
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? "text-teal" : "text-teal"}`}>
        30-day pilot
      </p>
      <h2 className={`mt-1 text-lg font-semibold ${isDark ? "text-white" : "text-navy"}`}>
        Request a pilot
      </h2>
      <p className={`mt-1.5 text-sm ${isDark ? "text-white/70" : "text-muted"}`}>
        {compact
          ? "Tell us who you are — we follow up by email. No credit card."
          : "Submit this form and we’ll email you back. Your request also goes straight to our team. No credit card."}
      </p>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="token" value="" />
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          <div>
            <Label htmlFor="public-pilot-name" className={labelClass}>
              Your name
            </Label>
            <Input
              id="public-pilot-name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Chen"
              disabled={pending}
              className={inputClass}
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="public-pilot-email" className={labelClass}>
              Work email
            </Label>
            <Input
              id="public-pilot-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              disabled={pending}
              className={inputClass}
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="public-pilot-agency" className={labelClass}>
            Agency name
          </Label>
          <Input
            id="public-pilot-agency"
            name="agencyName"
            required
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Summit Home Health"
            disabled={pending}
            className={inputClass}
            autoComplete="organization"
          />
        </div>
        <div>
          <Label htmlFor="public-pilot-note" className={labelClass}>
            What would make a pilot a win? (optional)
          </Label>
          <Textarea
            id="public-pilot-note"
            name="note"
            rows={compact ? 2 : 3}
            placeholder="e.g. Catch F2F gaps before claim · reduce LUPA on one branch…"
            disabled={pending}
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          className={
            isDark
              ? "mkt-btn-glow !bg-white !text-navy hover:!bg-white/90"
              : "mkt-btn-glow"
          }
        >
          {pending ? "Sending…" : "Submit pilot request"}
        </Button>
        {state.error ? (
          <p className={`text-xs ${isDark ? "text-red-200" : "text-danger"}`}>{state.error}</p>
        ) : null}
        <p className={`text-[11px] ${isDark ? "text-white/50" : "text-muted"}`}>
          Goes to {CONTACT_EMAIL}. Prefer email?{" "}
          <a
            href={contactMailto("Upheld pilot request")}
            className={isDark ? "text-white underline" : "font-medium text-teal hover:underline"}
          >
            Write us directly
          </a>
          .
        </p>
      </form>
    </div>
  );
}
