import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { InboxView } from "@/components/inbox/InboxView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { getConnectedEmails } from "@/lib/gmail";

export const metadata = { title: "Conversations — Aequora Digital" };

export default async function ConversationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";
  const canAccessInbox = isAdmin || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) redirect("/");

  const accounts = await getConnectedEmails(null);

  return (
    <InboxView
      scope="agency"
      isConnected={accounts.length > 0}
      accounts={accounts}
      isAdmin={isAdmin}
      currentUserId={session.user.id}
    />
  );
}
