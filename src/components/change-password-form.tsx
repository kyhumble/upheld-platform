"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type PasswordActionState,
} from "@/server/actions/auth";
import { Button, Input, Label } from "./ui";

const initial: PasswordActionState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="grid max-w-md gap-3">
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          disabled={pending}
        />
      </div>
      <div>
        <Label htmlFor="newPassword">New password (8+)</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-xs font-medium text-ok">Password updated.</p>
      ) : null}
    </form>
  );
}
