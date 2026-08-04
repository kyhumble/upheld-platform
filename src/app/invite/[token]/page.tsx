import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MarketingHeader } from "@/components/marketing-header";
import { AmbientBackdrop, PageEnter } from "@/components/site-motion";
import { AcceptInviteForm } from "@/components/accept-invite-form";

export const metadata = {
  title: "Accept team invite · Upheld",
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.agencyInvite.findUnique({
    where: { token },
    include: { agency: { select: { name: true } } },
  });

  if (!invite) notFound();

  const expired = invite.expiresAt.getTime() < Date.now();
  const invalid = !!invite.revokedAt || !!invite.acceptedAt || expired;

  return (
    <div className="relative min-h-screen bg-surface">
      <MarketingHeader />
      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-md px-4 py-12">
          <PageEnter>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
              Team invite
            </p>
            <h1 className="mt-2 font-display text-3xl text-navy">Join {invite.agency.name}</h1>
            <p className="mt-2 text-sm text-muted">
              You were invited as <strong className="text-navy">{invite.role}</strong> (
              {invite.email}).
            </p>
          </PageEnter>

          {invalid ? (
            <PageEnter delay={1}>
              <div className="mt-8 rounded-2xl border border-border bg-white p-6 text-sm text-muted">
                <p className="font-semibold text-navy">This invite is no longer valid</p>
                <p className="mt-2">
                  {invite.acceptedAt
                    ? "It was already accepted. Sign in with your email."
                    : invite.revokedAt
                      ? "It was cancelled by an admin."
                      : "It has expired. Ask an Admin to send a new invite."}
                </p>
                <Link
                  href="/sign-in"
                  className="mt-4 inline-block font-semibold text-teal hover:underline"
                >
                  Sign in →
                </Link>
              </div>
            </PageEnter>
          ) : (
            <PageEnter delay={1}>
              <div className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-sm">
                <AcceptInviteForm
                  token={token}
                  defaultName={invite.name ?? ""}
                  email={invite.email}
                />
              </div>
            </PageEnter>
          )}
        </main>
      </div>
    </div>
  );
}
