import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { ConversationsListView } from "@/components/conversations/ConversationsListView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export const metadata = { title: "Conversations — Aequora Digital" };

export default async function ConversationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";
  const canAccessInbox = isAdmin || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) redirect("/");

  return <ConversationsListView />;
}
