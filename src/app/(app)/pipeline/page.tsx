import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { PipelineView } from "@/components/pipeline/PipelineView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.view"));
  if (!canView) redirect("/");

  return <PipelineView />;
}
