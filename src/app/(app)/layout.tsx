import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

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
