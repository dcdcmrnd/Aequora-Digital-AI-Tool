import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { EditPageView } from "@/components/sites/EditPageView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function EditSitePagePage({ params }: { params: { id: string; pageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) redirect(`/sites/${params.id}`);

  return <EditPageView siteId={params.id} pageId={params.pageId} />;
}
