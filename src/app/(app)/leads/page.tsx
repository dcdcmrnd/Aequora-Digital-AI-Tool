import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LeadsSearchView } from "@/components/leads/LeadsSearchView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) redirect("/");

  return <LeadsSearchView />;
}
