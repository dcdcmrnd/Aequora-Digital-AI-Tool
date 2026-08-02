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

  const tokens = await prisma.gmailToken.findMany({ select: { email: true }, orderBy: { updatedAt: "asc" } });
  const accounts = tokens.map((t) => t.email);

  return (
    <InboxView
      isConnected={accounts.length > 0}
      accounts={accounts}
      isAdmin={isAdmin}
      currentUserId={session?.user?.id ?? ""}
    />
  );
}
