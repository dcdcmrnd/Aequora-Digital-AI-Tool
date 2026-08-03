import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { auditLead } from "@/services/audit";
import { type LeadWithAudit, upsertLeads } from "@/services/business";
import { searchBusinesses } from "@/services/google";

const SEARCH_MAX_RESULTS = 20;
const SEARCH_AUDIT_CONCURRENCY = 5;

export interface ExecuteSearchParams {
  userId: string;
  keyword: string;
  location: string;
  radiusMeters?: number;
}

export interface ExecuteSearchResult {
  leads: LeadWithAudit[];
  resultsCount: number;
  searchId: string;
}

/**
 * The full prospecting pipeline for one search: find businesses, save them
 * as leads, audit each website (or mark "No Website"), recompute
 * opportunity scores, and record the search in history. Audits run with
 * bounded concurrency so one search doesn't fan out unbounded PageSpeed
 * calls, and one lead's audit failing doesn't fail the whole search.
 */
export async function executeSearch(params: ExecuteSearchParams): Promise<ExecuteSearchResult> {
  const radiusMeters = params.radiusMeters ?? 5_000;

  // Created up front (before we know resultsCount) so its id can tag every
  // lead this search upserts — that tag is what lets the results table show
  // exactly what this search found later, instead of re-deriving it via
  // fuzzy category/location text matching against the whole shared table.
  const searchRow = await prisma.leadSearch.create({
    data: {
      userId: params.userId,
      keyword: params.keyword,
      location: params.location,
      radius: radiusMeters,
    },
  });

  const mapped = await searchBusinesses({
    keyword: params.keyword,
    location: params.location,
    radiusMeters,
    maxResults: SEARCH_MAX_RESULTS,
  });

  const leads = await upsertLeads(mapped, searchRow.id);

  const results = await mapWithConcurrency(
    leads,
    SEARCH_AUDIT_CONCURRENCY,
    async (lead): Promise<LeadWithAudit> => {
      try {
        const { lead: updated, audit } = await auditLead(lead);
        return { ...updated, audit };
      } catch (error) {
        console.error(`Audit failed for lead ${lead.id}:`, error);
        return { ...lead, audit: null };
      }
    },
  );

  await prisma.leadSearch.update({
    where: { id: searchRow.id },
    data: { resultsCount: results.length },
  });

  await logActivity({
    userId: params.userId,
    action: "created",
    entityType: "lead_search",
    entityId: searchRow.id,
    entityName: `${params.keyword} in ${params.location}`,
    metadata: { resultsCount: results.length },
  });

  return { leads: results, resultsCount: results.length, searchId: searchRow.id };
}
