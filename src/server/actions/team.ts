"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createSession,
  getValidSession,
  hashPassword,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { buildAgencyInviteEmail, sendEmail } from "@/lib/email";

export type TeamActionState = { ok?: boolean; error?: string; message?: string };

const ROLES: MembershipRole[] = ["ADMIN", "QA", "CLINICAL", "EXECUTIVE"];

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function parseRole(raw: string): MembershipRole | null {
  const r = raw.trim().toUpperCase() as MembershipRole;
  return ROLES.includes(r) ? r : null;
}

function canManageTeam(role: MembershipRole): boolean {
  return role === "ADMIN";
}

/** Admin invites a teammate by email. */
export async function inviteTeammateAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required." };
  if (!canManageTeam(session.role)) {
    return { error: "Only agency Admins can invite teammates." };
  }

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  const role = parseRole(String(formData.get("role") ?? "QA"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid work email." };
  }
  if (!role) return { error: "Choose a valid role." };

  // Already an active member?
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { agencyId: session.agencyId, status: "ACTIVE" },
      },
    },
  });
  if (existingUser?.memberships.length) {
    return { error: "That person is already an active member of this agency." };
  }

  // Revoke prior pending invites for same email+agency
  await prisma.agencyInvite.updateMany({
    where: {
      agencyId: session.agencyId,
      email,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const token = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const invite = await prisma.agencyInvite.create({
    data: {
      agencyId: session.agencyId,
      email,
      name,
      role,
      token,
      invitedById: session.userId,
      expiresAt,
    },
  });

  const agency = await prisma.agency.findUnique({ where: { id: session.agencyId } });
  const inviteUrl = `${appUrl()}/invite/${token}`;

  const payload = buildAgencyInviteEmail({
    to: email,
    inviteeName: name,
    inviterName: session.name,
    agencyName: agency?.name ?? session.agencyName,
    role,
    inviteUrl,
    expiresAt,
  });

  const mail = await sendEmail({
    to: email,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: session.email,
    tags: [
      { name: "app", value: "upheld" },
      { name: "type", value: "team_invite" },
    ],
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: mail.ok ? "team.invite_sent" : "team.invite_email_failed",
    entityType: "AgencyInvite",
    entityId: invite.id,
    meta: { email, role, mode: mail.mode, error: mail.error },
  });

  if (!mail.ok) {
    return {
      error: mail.error
        ? `Invite saved but email failed: ${mail.error}`
        : "Invite saved but email failed. Share the invite link from Activity or re-send.",
      message: inviteUrl,
    };
  }

  revalidatePath("/settings");
  revalidatePath("/activity");
  return { ok: true, message: `Invite sent to ${email}.` };
}

/** Admin changes a member's role. */
export async function updateMemberRoleAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required." };
  if (!canManageTeam(session.role)) return { error: "Only Admins can change roles." };

  const membershipId = String(formData.get("membershipId") ?? "");
  const role = parseRole(String(formData.get("role") ?? ""));
  if (!membershipId || !role) return { error: "Invalid role update." };

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, agencyId: session.agencyId },
  });
  if (!membership) return { error: "Member not found." };
  if (membership.userId === session.userId && role !== "ADMIN") {
    return { error: "You cannot remove your own Admin role." };
  }

  // Prevent demoting the last admin
  if (membership.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { agencyId: session.agencyId, status: "ACTIVE", role: "ADMIN" },
    });
    if (adminCount <= 1) return { error: "Keep at least one Admin on the agency." };
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: { role },
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: "team.role_updated",
    entityType: "Membership",
    entityId: membershipId,
    meta: { role, targetUserId: membership.userId },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Role updated." };
}

/** Admin revokes a member (soft — status REVOKED). */
export async function revokeMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required." };
  if (!canManageTeam(session.role)) return { error: "Only Admins can remove teammates." };

  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return { error: "Member not found." };

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, agencyId: session.agencyId, status: "ACTIVE" },
  });
  if (!membership) return { error: "Member not found." };
  if (membership.userId === session.userId) {
    return { error: "You cannot remove yourself." };
  }
  if (membership.role === "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { agencyId: session.agencyId, status: "ACTIVE", role: "ADMIN" },
    });
    if (adminCount <= 1) return { error: "Keep at least one Admin on the agency." };
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: { status: "REVOKED" },
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: "team.member_revoked",
    entityType: "Membership",
    entityId: membershipId,
    meta: { targetUserId: membership.userId },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Member removed from this agency." };
}

/** Admin cancels a pending invite. */
export async function revokeInviteAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required." };
  if (!canManageTeam(session.role)) return { error: "Only Admins can manage invites." };

  const inviteId = String(formData.get("inviteId") ?? "");
  const invite = await prisma.agencyInvite.findFirst({
    where: { id: inviteId, agencyId: session.agencyId, acceptedAt: null },
  });
  if (!invite) return { error: "Invite not found." };

  await prisma.agencyInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: "team.invite_revoked",
    entityType: "AgencyInvite",
    entityId: inviteId,
    meta: { email: invite.email },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Invite cancelled." };
}

/** Accept invite: set password and join agency. */
export async function acceptInviteAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "Invalid invite link." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const invite = await prisma.agencyInvite.findUnique({
    where: { token },
    include: { agency: true },
  });
  if (!invite || invite.revokedAt || invite.acceptedAt) {
    return { error: "This invite is no longer valid." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { error: "This invite has expired. Ask an Admin to send a new one." };
  }

  const displayName = name || invite.name || invite.email.split("@")[0];
  const passwordHash = await hashPassword(password);

  let user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (user) {
    // Existing user (e.g. other agency or re-invite): update name/password optional
    await prisma.user.update({
      where: { id: user.id },
      data: { name: displayName, passwordHash },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: invite.email,
        name: displayName,
        passwordHash,
      },
    });
  }

  // Existing membership (revoked or invited)?
  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_agencyId: { userId: user.id, agencyId: invite.agencyId },
    },
  });

  let membershipId: string;
  if (existingMembership) {
    const updated = await prisma.membership.update({
      where: { id: existingMembership.id },
      data: { status: "ACTIVE", role: invite.role },
    });
    membershipId = updated.id;
  } else {
    const created = await prisma.membership.create({
      data: {
        userId: user.id,
        agencyId: invite.agencyId,
        role: invite.role,
        status: "ACTIVE",
      },
    });
    membershipId = created.id;
  }

  await prisma.agencyInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await writeAudit({
    agencyId: invite.agencyId,
    userId: user.id,
    action: "team.invite_accepted",
    entityType: "Membership",
    entityId: membershipId,
    meta: { email: invite.email, role: invite.role },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    name: displayName,
    agencyId: invite.agencyId,
    agencyName: invite.agency.name,
    role: invite.role,
    membershipId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/dashboard");
}
