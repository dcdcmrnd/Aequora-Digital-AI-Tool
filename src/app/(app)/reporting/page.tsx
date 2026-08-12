import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { EmailReportingView } from "@/components/reporting/EmailReportingView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export const metadata = { title: "Reporting — Aequora Digital" };

export default async function ReportingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";
  const canView = isAdmin || (await checkPermission(session.user.id, "company.email"));
  if (!canView) redirect("/");

  return <EmailReportingView />;
}
