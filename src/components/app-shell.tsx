import Link from "next/link";
import { signOutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { Button } from "./ui";
import { Logo } from "./logo";
import { DesktopNav, MobileNav } from "./app-nav";
import { DemoBanner } from "./demo-banner";
import { AppPageMotion } from "./site-motion";

export function AppShell({
  user,
  children,
  openIssues = 0,
}: {
  user: SessionUser;
  children: React.ReactNode;
  openIssues?: number;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <DemoBanner email={user.email} />
      <header className="sticky top-0 z-30 border-b border-border bg-navy text-white shadow-lg shadow-navy/20">
        <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 transition hover:opacity-90"
            >
              <Logo size={26} invertWordmark priority />
            </Link>
            <DesktopNav openIssues={openIssues} />
            <MobileNav openIssues={openIssues} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right md:block">
              <div className="max-w-[10rem] truncate text-xs font-medium">{user.name}</div>
              <div className="max-w-[10rem] truncate text-[10px] text-white/55">
                {user.agencyName}
              </div>
            </div>
            <Link
              href="/settings"
              className="hidden rounded-md px-2 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white sm:inline"
            >
              Settings
            </Link>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="!border-white/20 !bg-white/10 !text-white transition hover:!bg-white/20"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <AppPageMotion>{children}</AppPageMotion>
      </main>
      <footer className="border-t border-border bg-white/60 py-4 text-center text-[11px] text-muted backdrop-blur-sm">
        Upheld · Clinical Revenue Integrity · Human review required ·{" "}
        <Link href="/trust" className="text-teal hover:underline">
          Trust
        </Link>
        {" · "}
        <Link href="/calculations" className="text-teal hover:underline">
          Calculations
        </Link>
      </footer>
    </div>
  );
}
