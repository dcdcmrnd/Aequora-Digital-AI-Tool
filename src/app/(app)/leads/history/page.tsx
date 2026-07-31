import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LeadHistoryView } from "@/components/leads/LeadHistoryView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function LeadHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) redirect("/");

  return <LeadHistoryView />;
}
