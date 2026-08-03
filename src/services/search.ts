import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { auditLead } from "@/services/audit";
import { type LeadWithAudit, upsertLeads } from "@/services/business";
import { enrichLead } from "@/services/enrichment";
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
 * as leads, audit each website (or mark "No Website") and scan it for a
 * contact email/social links, recompute opportunity scores, and record the
 * search in history. Audits and enrichment run with bounded concurrency so
 * one search doesn't fan out unbounded PageSpeed/website calls, and one
 * lead's audit or enrichment failing never fails the whole search.
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
      let current = lead;
      let audit = null;
      try {
        const outcome = await auditLead(current);
        current = outcome.lead;
        audit = outcome.audit;
      } catch (error) {
        console.error(`Audit failed for lead ${lead.id}:`, error);
      }
      // enrichLead is already best-effort internally (never throws), but
      // guard anyway so a future change to it can't take down the search.
      try {
        current = await enrichLead(current);
      } catch (error) {
        console.error(`Enrichment failed for lead ${lead.id}:`, error);
      }
      return { ...current, audit };
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
