import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { ConversationsView } from "@/components/conversations/ConversationsView";
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

  if (accounts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-white p-8 text-center">
        <p className="text-text-primary text-sm font-medium">Gmail isn&apos;t connected yet</p>
        <p className="text-text-muted mt-1 text-sm">
          Connect it in Settings → Agency Email to see conversations here.
        </p>
      </div>
    );
  }

  return <ConversationsView />;
}
