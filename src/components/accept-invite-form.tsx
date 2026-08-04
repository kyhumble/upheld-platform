"use client";

import { useActionState } from "react";
import { acceptInviteAction, type TeamActionState } from "@/server/actions/team";
import { Button, Input, Label } from "./ui";

const initial: TeamActionState = {};

export function AcceptInviteForm({
  token,
  defaultName,
  email,
}: {
  token: string;
  defaultName: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted">
        Set a password for <strong className="text-navy">{email}</strong> to join this agency
        workspace.
      </p>
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          required
          disabled={pending}
          autoComplete="name"
        />
      </div>
      <div>
        <Label htmlFor="password">Password (8+)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          disabled={pending}
          autoComplete="new-password"
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          disabled={pending}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={pending} className="mkt-btn-glow w-full">
        {pending ? "Joining…" : "Accept invite & open workspace"}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
