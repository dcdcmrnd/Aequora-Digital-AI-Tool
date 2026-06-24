import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AIChatPanel } from "@/components/ai/AIChatPanel";

export default async function AIPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [canUseTask, canUseConsultant] = await Promise.all([
    checkPermission(session.user.id, "ai.task_assistant"),
    checkPermission(session.user.id, "ai.consultant"),
  ]);

  const isAdmin = session.user.role === "admin";
  const hasAccess = isAdmin || canUseTask || canUseConsultant;
  if (!hasAccess) redirect("/");

  return (
    <div className="h-full">
      <AIChatPanel
        canUseTaskAssistant={isAdmin || canUseTask}
        canUseConsultant={isAdmin || canUseConsultant}
      />
    </div>
  );
}
