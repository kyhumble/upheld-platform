import Link from "next/link";

const DEMO_EMAILS = new Set([
  "admin@demo.local",
  "qa@demo.local",
  "clinical@demo.local",
  "exec@demo.local",
]);

export function DemoBanner({ email }: { email: string }) {
  if (!DEMO_EMAILS.has(email.toLowerCase())) return null;
  return (
    <div className="border-b border-teal/20 bg-teal-light px-4 py-2 text-center text-xs text-navy">
      <strong>Demo agency</strong> — synthetic data only · change password in{" "}
      <Link href="/settings" className="font-semibold text-teal underline-offset-2 hover:underline">
        Settings
      </Link>{" "}
      ·{" "}
      <Link href="/batch" className="font-semibold text-teal underline-offset-2 hover:underline">
        Retrospective batch
      </Link>{" "}
      ·{" "}
      <Link href="/trust" className="font-semibold text-teal underline-offset-2 hover:underline">
        Trust
      </Link>
    </div>
  );
}
