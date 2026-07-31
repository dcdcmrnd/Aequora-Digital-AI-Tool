import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SavedLeadsView } from "@/components/leads/SavedLeadsView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function SavedLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) redirect("/");

  return <SavedLeadsView />;
}
