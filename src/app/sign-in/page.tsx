import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signInAction, registerAgencyAction } from "@/server/actions/auth";
import { MarketingHeader } from "@/components/marketing-header";
import { Button, Card, Input, Label } from "@/components/ui";
import { AmbientBackdrop, PageEnter } from "@/components/site-motion";

export const metadata = {
  title: "Sign in · Create account",
  description: "Sign in to Upheld or create a free agency account for Chart Scan history and retrospective batch.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const sp = await searchParams;
  const signupFirst = sp.mode === "signup" || sp.mode === "register";

  const errorMsg =
    sp.error === "invalid"
      ? "Invalid email or password."
      : sp.error === "exists"
        ? "An account with that email already exists."
        : sp.error === "register"
          ? "Agency, name, email, and password (8+ chars) are required."
          : null;

  const signInCard = (
    <div id="signin" className="scroll-mt-24">
    <Card className="p-6" hover>
      <h1 className="text-lg font-semibold text-navy">
        {signupFirst ? "Already have an account?" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Agency workspace · scan history · retrospective batch
      </p>
      {errorMsg && !signupFirst ? (
        <div className="mt-4 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </div>
      ) : null}
      {errorMsg && signupFirst && sp.error === "invalid" ? (
        <div className="mt-4 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </div>
      ) : null}
      <form action={signInAction} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@agency.com"
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" variant={signupFirst ? "secondary" : "primary"}>
          Sign in
        </Button>
      </form>
      {!signupFirst ? (
        <p className="mt-4 text-sm text-muted">
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-teal hover:underline">
            Create a free agency account
          </Link>
        </p>
      ) : null}
    </Card>
    </div>
  );

  const signUpCard = (
    <div id="signup" className="scroll-mt-24">
    <Card
      hover
      className={`p-6 ${signupFirst ? "border-teal/40 ring-2 ring-teal/20 shadow-lg shadow-teal/10" : ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">Free</p>
      <h2 className="mt-1 text-lg font-semibold text-navy">Create agency account</h2>
      <p className="mt-1 text-sm text-muted">
        Free tier for Chart Scan history + retrospective batch. De-identified packets until BAA
        signed.
      </p>
      {errorMsg && signupFirst && sp.error !== "invalid" ? (
        <div className="mt-4 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </div>
      ) : null}
      <form action={registerAgencyAction} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="agencyName">Agency name</Label>
          <Input id="agencyName" name="agencyName" required placeholder="Summit Home Health" />
        </div>
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required placeholder="Alex Chen" />
        </div>
        <div>
          <Label htmlFor="reg-email">Work email</Label>
          <Input
            id="reg-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@agency.com"
          />
        </div>
        <div>
          <Label htmlFor="reg-password">Password (8+)</Label>
          <Input
            id="reg-password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" variant={signupFirst ? "primary" : "secondary"}>
          Create free account
        </Button>
      </form>
      {signupFirst ? (
        <p className="mt-4 text-sm text-muted">
          Already registered?{" "}
          <Link href="/sign-in" className="font-semibold text-teal hover:underline">
            Sign in
          </Link>
        </p>
      ) : null}
    </Card>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-paper">
      <MarketingHeader />
      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-5xl px-4 py-12">
          <PageEnter>
            <div className="mb-8 text-center lg:text-left">
              <h1 className="font-display text-3xl text-navy">
                {signupFirst ? "Create your agency account" : "Sign in to Upheld"}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {signupFirst
                  ? "Takes under a minute. No credit card. Start Free Chart Scan history and batch proof."
                  : "Access your agency workspace — or create a free account if you’re new."}
              </p>
            </div>
          </PageEnter>
          <div className="grid gap-8 lg:grid-cols-2">
            {signupFirst ? (
              <>
                <PageEnter delay={1}>{signUpCard}</PageEnter>
                <PageEnter delay={2}>{signInCard}</PageEnter>
              </>
            ) : (
              <>
                <PageEnter delay={1}>{signInCard}</PageEnter>
                <PageEnter delay={2}>{signUpCard}</PageEnter>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
