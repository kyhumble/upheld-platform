"use client";

import { useActionState } from "react";
import {
  inviteTeammateAction,
  revokeInviteAction,
  revokeMemberAction,
  updateMemberRoleAction,
  type TeamActionState,
} from "@/server/actions/team";
import { Button, Input, Label, Select } from "./ui";

const initial: TeamActionState = {};

export function InviteTeammateForm() {
  const [state, action, pending] = useActionState(inviteTeammateAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="invite-name">Name</Label>
        <Input id="invite-name" name="name" placeholder="Sam Rivera" disabled={pending} />
      </div>
      <div>
        <Label htmlFor="invite-email">Work email *</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="sam@agency.com"
          disabled={pending}
        />
      </div>
      <div>
        <Label htmlFor="invite-role">Role</Label>
        <Select id="invite-role" name="role" defaultValue="QA" disabled={pending}>
          <option value="QA">QA</option>
          <option value="CLINICAL">Clinical</option>
          <option value="EXECUTIVE">Executive</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending invite…" : "Send invite"}
        </Button>
      </div>
      {state.error ? (
        <p className="sm:col-span-2 text-xs text-danger">
          {state.error}
          {state.message ? (
            <>
              {" "}
              <span className="break-all text-muted">Link: {state.message}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {state.ok ? (
        <p className="sm:col-span-2 text-xs text-ok">{state.message ?? "Invite sent."}</p>
      ) : null}
      <p className="sm:col-span-2 text-[11px] text-muted">
        They receive an email with a link to set a password and join this agency only. Link expires
        in 14 days.
      </p>
    </form>
  );
}

export function MemberRoleForm({
  membershipId,
  currentRole,
  disabled,
}: {
  membershipId: string;
  currentRole: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(updateMemberRoleAction, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || pending}
        className="!w-auto min-w-[8rem] text-xs"
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
      >
        <option value="ADMIN">ADMIN</option>
        <option value="QA">QA</option>
        <option value="CLINICAL">CLINICAL</option>
        <option value="EXECUTIVE">EXECUTIVE</option>
      </Select>
      {state.error ? <span className="text-[10px] text-danger">{state.error}</span> : null}
    </form>
  );
}

export function RevokeMemberButton({
  membershipId,
  label,
}: {
  membershipId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(revokeMemberAction, initial);

  return (
    <form action={action}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={pending}
        className="!text-danger hover:!bg-red-50"
        onClick={(e) => {
          if (!confirm(`Remove ${label} from this agency?`)) e.preventDefault();
        }}
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <p className="text-[10px] text-danger">{state.error}</p> : null}
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(revokeInviteAction, initial);

  return (
    <form action={action}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "…" : "Cancel invite"}
      </Button>
      {state.error ? <p className="text-[10px] text-danger">{state.error}</p> : null}
    </form>
  );
}
