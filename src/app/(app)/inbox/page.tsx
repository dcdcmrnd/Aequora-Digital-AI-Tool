import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InboxView } from "@/components/inbox/InboxView";

export const metadata = { title: "Inbox — Aequora Digital" };

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";

  const token = await prisma.gmailToken.findUnique({
    where: { email: "info@aequoradigital.com" },
    select: { id: true },
  });

  return <InboxView isConnected={!!token} isAdmin={isAdmin} />;
}
