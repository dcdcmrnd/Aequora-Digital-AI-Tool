import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LeadDetailsView } from "@/components/leads/LeadDetailsView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@/types";

export default async function LeadDetailsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) redirect("/");

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, include: { audit: true } });
  if (!lead) notFound();

  const savedLead = await prisma.savedLead.findUnique({
    where: { userId_leadId: { userId: session.user.id, leadId: params.id } },
  });

  return (
    <LeadDetailsView
      lead={{
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        opportunityScoreUpdatedAt: lead.opportunityScoreUpdatedAt?.toISOString() ?? null,
        enrichedAt: lead.enrichedAt?.toISOString() ?? null,
        audit: lead.audit
          ? {
              ...lead.audit,
              lastScanned: lead.audit.lastScanned.toISOString(),
              createdAt: lead.audit.createdAt.toISOString(),
            }
          : null,
      }}
      initialSavedLead={
        savedLead
          ? {
              ...savedLead,
              status: savedLead.status as LeadStatus,
              tags: JSON.parse(savedLead.tags) as string[],
              followUpDate: savedLead.followUpDate?.toISOString() ?? null,
              createdAt: savedLead.createdAt.toISOString(),
              updatedAt: savedLead.updatedAt.toISOString(),
            }
          : null
      }
    />
  );
}
