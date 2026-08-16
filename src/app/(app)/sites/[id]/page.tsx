import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SiteDetailView } from "@/components/sites/SiteDetailView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function SiteDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.view"));
  if (!canView) redirect("/");

  return <SiteDetailView siteId={params.id} />;
}
