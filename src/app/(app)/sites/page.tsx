import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SitesListView } from "@/components/sites/SitesListView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function SitesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.view"));
  if (!canView) redirect("/");

  return <SitesListView />;
}
