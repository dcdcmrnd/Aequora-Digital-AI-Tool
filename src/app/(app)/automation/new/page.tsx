import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AutomationBuilder } from "@/components/automation/AutomationBuilder";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function NewAutomationPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) redirect("/automation");

  return <AutomationBuilder />;
}
