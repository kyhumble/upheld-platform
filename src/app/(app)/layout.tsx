import { redirect } from "next/navigation";
import { getValidSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getValidSession();
  if (!session) redirect("/sign-in");

  const openIssues = await prisma.chartFinding.count({
    where: {
      status: "OPEN",
      scan: { agencyId: session.agencyId, status: "COMPLETE" },
    },
  });

  return (
    <AppShell user={session} openIssues={openIssues}>
      {children}
    </AppShell>
  );
}
