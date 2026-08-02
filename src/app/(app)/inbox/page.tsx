import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { InboxView } from "@/components/inbox/InboxView";

export const metadata = { title: "Inbox — Aequora Digital" };

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const isAdmin = session.user.role === "admin";
  const canAccessInbox = isAdmin || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) redirect("/");

  const token = await prisma.gmailToken.findFirst({ select: { email: true } });

  return (
    <InboxView
      isConnected={!!token}
      connectedEmail={token?.email ?? null}
      isAdmin={isAdmin}
      currentUserId={session?.user?.id ?? ""}
    />
  );
}
