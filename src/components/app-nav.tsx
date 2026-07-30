"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavItem = {
  href: string;
  label: string;
  badgeKey?: "openIssues";
};

/** Always in the top bar */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/batch", label: "Batch" },
  { href: "/scans", label: "Scans" },
  { href: "/issues", label: "Issues", badgeKey: "openIssues" },
];

/** Nested under More */
export const MORE_NAV: NavItem[] = [
  { href: "/executive", label: "Executive" },
  { href: "/clinicians", label: "Clinicians" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  openIssues,
  onNavigate,
  className,
}: {
  item: NavItem;
  openIssues: number;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        className ??
        `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
          active
            ? "bg-white/15 font-semibold text-white"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      {item.label}
      {item.badgeKey === "openIssues" && openIssues > 0 ? (
        <span className="min-w-[1.25rem] rounded-full bg-warn px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-white">
          {openIssues > 99 ? "99+" : openIssues}
        </span>
      ) : null}
    </Link>
  );
}

export function DesktopNav({ openIssues = 0 }: { openIssues?: number }) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const moreActive = MORE_NAV.some((l) => isActive(pathname, l.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <nav className="hidden items-center gap-0.5 lg:flex">
      {PRIMARY_NAV.map((l) => (
        <NavLink key={l.href} item={l} openIssues={openIssues} />
      ))}

      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={() => setMoreOpen((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition ${
            moreOpen || moreActive
              ? "bg-white/15 font-semibold text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          More
          <span className="text-[10px] opacity-70" aria-hidden>
            ▾
          </span>
        </button>
        {moreOpen ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-white/10 bg-navy py-1 shadow-xl"
          >
            {MORE_NAV.map((l) => (
              <NavLink
                key={l.href}
                item={l}
                openIssues={openIssues}
                onNavigate={() => setMoreOpen(false)}
                className={`flex w-full items-center px-3 py-2 text-sm ${
                  isActive(pathname, l.href)
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Link
        href="/scan"
        className="ml-1 rounded-md bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#06968b]"
      >
        New scan
      </Link>
    </nav>
  );
}

export function MobileNav({ openIssues = 0 }: { openIssues?: number }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white"
      >
        Menu
        {openIssues > 0 ? (
          <span className="rounded-full bg-warn px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
            {openIssues > 99 ? "99+" : openIssues}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-14 z-40 border-b border-border bg-navy px-4 py-3 shadow-lg">
          <nav className="flex flex-col gap-0.5">
            {PRIMARY_NAV.map((l) => (
              <NavLink
                key={l.href}
                item={l}
                openIssues={openIssues}
                onNavigate={() => setOpen(false)}
                className={`inline-flex items-center justify-between rounded-md px-3 py-2.5 text-sm ${
                  isActive(pathname, l.href)
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/90 hover:bg-white/10"
                }`}
              />
            ))}
            <Link
              href="/scan"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-md bg-teal px-3 py-2.5 text-center text-sm font-semibold text-white"
            >
              New scan
            </Link>
            <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              More
            </p>
            {MORE_NAV.map((l) => (
              <NavLink
                key={l.href}
                item={l}
                openIssues={openIssues}
                onNavigate={() => setOpen(false)}
                className={`inline-flex items-center rounded-md px-3 py-2 text-sm ${
                  isActive(pathname, l.href)
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              />
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
