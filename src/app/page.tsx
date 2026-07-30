import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MarketingHeader } from "@/components/marketing-header";
import { LandingDynamic } from "@/components/landing-dynamic";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <LandingDynamic />
    </div>
  );
}
