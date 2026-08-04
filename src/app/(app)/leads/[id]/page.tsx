import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LeadDetailsView } from "@/components/leads/LeadDetailsView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listLeadIds, type LeadSortColumn } from "@/services/business";
import type { LeadStatus } from "@/types";

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadDetailsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) redirect("/");

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, include: { audit: true } });
  if (!lead) notFound();

  const savedLead = await prisma.savedLead.findUnique({
    where: { userId_leadId: { userId: session.user.id, leadId: params.id } },
  });

  // The same filter/sort context the Leads search table was showing when this
  // lead was opened — reused here to compute Previous/Next without asking the
  // user to go back to the list, and forwarded again so Next/Prev keeps working
  // as they continue browsing.
  const searchId = firstOf(searchParams.searchId);
  const category = firstOf(searchParams.category);
  const location = firstOf(searchParams.location);
  const minRating = firstOf(searchParams.minRating);
  const minReviews = firstOf(searchParams.minReviews);
  const hasWebsite = firstOf(searchParams.hasWebsite);
  const hasEmail = firstOf(searchParams.hasEmail);
  const sortBy = firstOf(searchParams.sortBy) as LeadSortColumn | undefined;
  const sortDirection = firstOf(searchParams.sortDirection) === "asc" ? "asc" : "desc";

  let prevId: string | null = null;
  let nextId: string | null = null;
  if (searchId || category || location) {
    const ids = await listLeadIds({
      searchId,
      category,
      location,
      minRating: minRating ? Number(minRating) : undefined,
      minReviews: minReviews ? Number(minReviews) : undefined,
      hasWebsite: hasWebsite === "true" ? true : hasWebsite === "false" ? false : undefined,
      hasEmail: hasEmail === "true" ? true : hasEmail === "false" ? false : undefined,
      sortBy,
      sortDirection,
    });
    const index = ids.indexOf(params.id);
    if (index !== -1) {
      prevId = index > 0 ? ids[index - 1] : null;
      nextId = index < ids.length - 1 ? ids[index + 1] : null;
    }
  }

  const listParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const v = firstOf(value);
    if (v) listParams.set(key, v);
  }

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
      prevId={prevId}
      nextId={nextId}
      listParams={listParams.toString()}
    />
  );
}
