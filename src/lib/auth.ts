import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { MembershipRole, MembershipStatus } from "@prisma/client";

const COOKIE = "upheld_session";

const secret = () =>
  new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me!!",
  );

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  agencyId: string;
  agencyName: string;
  role: MembershipRole;
  membershipId: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Session with live DB check — clears stale cookies after reseed / agency wipe
 * so ChartScan.agencyId FK does not explode.
 */
export async function getValidSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.agencyId || !session.userId) return null;

  const membership = await prisma.membership.findFirst({
    where: {
      id: session.membershipId,
      userId: session.userId,
      agencyId: session.agencyId,
      status: "ACTIVE",
    },
    include: { agency: true, user: true },
  });

  if (!membership) {
    await destroySession();
    return null;
  }

  return {
    userId: membership.userId,
    email: membership.user.email,
    name: membership.user.name,
    agencyId: membership.agencyId,
    agencyName: membership.agency.name,
    role: membership.role,
    membershipId: membership.id,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getValidSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      memberships: {
        where: { status: "ACTIVE" as MembershipStatus },
        include: { agency: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user || user.memberships.length === 0) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  const m = user.memberships[0];
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    agencyId: m.agencyId,
    agencyName: m.agency.name,
    role: m.role,
    membershipId: m.id,
  };
}

export function canSeeRevenue(role: MembershipRole): boolean {
  return role === "ADMIN" || role === "EXECUTIVE";
}

export function canManageFindings(role: MembershipRole): boolean {
  return role === "ADMIN" || role === "QA" || role === "CLINICAL";
}
