"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";

type NavLink = { href: string; label: string };

const NAV: NavLink[] = [
  { href: "/#how", label: "What you get" },
  { href: "/#product", label: "How to use it" },
  { href: "/pilot", label: "Request pilot" },
  { href: "/trust", label: "Trust" },
];

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingHeader({
  active,
}: {
  /** Optional override when hash routes don't update pathname */
  active?: string;
}) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="min-w-0 shrink-0" onClick={() => setOpen(false)}>
          <Logo size={32} subtitle="Clinical Revenue Integrity" priority />
        </Link>

        {/* Primary nav — center on large screens */}
        <nav
          className="ml-2 hidden flex-1 items-center justify-center gap-0.5 lg:flex"
          aria-label="Primary"
        >
          {NAV.map((item) => {
            const activeLink =
              active === item.href || isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={activeLink ? "true" : "false"}
                className={`mkt-header-link rounded-md px-3 py-2 text-[13px] font-medium transition ${
                  activeLink
                    ? "bg-mist text-navy"
                    : "text-muted hover:bg-mist/80 hover:text-navy"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 sm:flex">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:text-navy"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] font-semibold text-navy shadow-sm hover:bg-mist"
            >
              Create account
            </Link>
          </div>
          <Link
            href="/scan"
            className="rounded-lg bg-navy px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-navy/90"
          >
            Free scan
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-navy lg:hidden"
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            {open ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div
          id="marketing-mobile-nav"
          className="border-t border-border bg-white lg:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy hover:bg-mist"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-border" />
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-mist hover:text-navy"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-mist"
            >
              Create account
            </Link>
            <Link
              href="/status"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-mist"
            >
              System status
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
