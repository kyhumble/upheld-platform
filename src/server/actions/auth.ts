"use server";

import { redirect } from "next/navigation";
import {
  authenticate,
  createSession,
  destroySession,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(email, password);
  if (!user) {
    redirect("/sign-in?error=invalid");
  }
  await createSession(user);
  await writeAudit({
    agencyId: user.agencyId,
    userId: user.userId,
    action: "auth.sign_in",
  });
  redirect("/dashboard");
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in");
}

export type PasswordActionState = { error?: string; ok?: boolean };

export async function changePasswordAction(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };
  if (current === next) return { error: "New password must differ from the current one." };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "User not found." };

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: await hashPassword(next) },
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: "auth.password_changed",
  });

  return { ok: true };
}

export async function registerAgencyAction(formData: FormData) {
  const agencyName = String(formData.get("agencyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!agencyName || !name || !email || password.length < 8) {
    redirect("/sign-in?mode=signup&error=register");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/sign-in?mode=signup&error=exists");

  const slugBase = agencyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${slugBase || "agency"}-${Date.now().toString(36)}`;

  const passwordHash = await hashPassword(password);
  const agency = await prisma.agency.create({
    data: {
      name: agencyName,
      slug,
      planTier: "free",
      baaStatus: "none",
      memberships: {
        create: {
          role: "ADMIN",
          status: "ACTIVE",
          user: {
            create: {
              email,
              name,
              passwordHash,
            },
          },
        },
      },
    },
    include: { memberships: { include: { user: true } } },
  });

  const m = agency.memberships[0];
  await createSession({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    agencyId: agency.id,
    agencyName: agency.name,
    role: m.role,
    membershipId: m.id,
  });

  await writeAudit({
    agencyId: agency.id,
    userId: m.userId,
    action: "auth.register_agency",
  });

  redirect("/dashboard");
}
