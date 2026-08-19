import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { maybeRunOpportunisticSweep } from "@/lib/automation/engine";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Check if setup is needed
  const userCount = await prisma.user.count();
  if (userCount === 0) redirect("/setup");

  // Cron on this project's Vercel plan only runs once a day -- piggyback a
  // small, cooldown-gated catch-up pass on real navigation so due waits and
  // stuck runs resolve close to on time instead of up to 24h late. See
  // maybeRunOpportunisticSweep's doc comment for why this is safe to await
  // inline here.
  await maybeRunOpportunisticSweep();

  let companyName = "Aequora Digital";
  let companyLogoUrl: string | null = null;
  try {
    const settings = await prisma.companySettings.findUnique({ where: { id: "singleton" } });
    if (settings) {
      companyName = settings.name;
      companyLogoUrl = settings.logoUrl;
    }
  } catch {}

  return (
    <AppShell companyName={companyName} companyLogoUrl={companyLogoUrl}>
      {children}
    </AppShell>
  );
}
