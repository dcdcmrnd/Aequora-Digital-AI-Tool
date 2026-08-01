import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AutomationBuilder } from "@/components/automation/AutomationBuilder";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { AutomationActionType, AutomationTriggerType } from "@/types";

export default async function EditAutomationPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) redirect("/automation");

  const automation = await prisma.automation.findUnique({
    where: { id: params.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  if (!automation) notFound();

  return (
    <AutomationBuilder
      automation={{
        id: automation.id,
        name: automation.name,
        isActive: automation.isActive,
        triggerType: automation.triggerType as AutomationTriggerType,
        triggerConfig: JSON.parse(automation.triggerConfig),
        createdById: automation.createdById,
        actions: automation.actions.map((action) => ({
          id: action.id,
          automationId: action.automationId,
          order: action.order,
          actionType: action.actionType as AutomationActionType,
          config: JSON.parse(action.config),
        })),
        createdAt: automation.createdAt.toISOString(),
        updatedAt: automation.updatedAt.toISOString(),
      }}
    />
  );
}
