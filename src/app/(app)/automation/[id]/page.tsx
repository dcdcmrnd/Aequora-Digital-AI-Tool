import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AutomationBuilder } from "@/components/automation/AutomationBuilder";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function EditAutomationPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) redirect("/automation");

  const automation = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!automation) notFound();

  return (
    <AutomationBuilder
      automation={{
        id: automation.id,
        name: automation.name,
        isActive: automation.isActive,
        allowMultipleEntries: automation.allowMultipleEntries,
        allowReentry: automation.allowReentry,
        webhookSecret: automation.webhookSecret,
        flow: JSON.parse(automation.flow),
        createdById: automation.createdById,
        createdAt: automation.createdAt.toISOString(),
        updatedAt: automation.updatedAt.toISOString(),
      }}
    />
  );
}
