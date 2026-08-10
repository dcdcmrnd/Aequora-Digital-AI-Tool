import type { Lead, LeadAudit, Prisma } from "@prisma/client";

import type { MappedBusiness } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export type { Lead, LeadAudit };

export interface LeadWithAudit extends Lead {
  audit: LeadAudit | null;
}

export type LeadSortColumn = "opportunityScore" | "reviewCount" | "rating" | "createdAt" | "email";

/**
 * Google's Places category taxonomy rarely matches the user's typed keyword
 * verbatim (e.g. searching "consulting" returns businesses categorized as
 * "Consultant") — a plain substring match on the raw keyword misses almost
 * everything. Stripping a trailing "ing"/"ies"/"es"/"s" and matching on that
 * stem too bridges the common English word-form gaps (consulting/consultant,
 * plumbers/plumber, bakeries/bakery) without needing a real stemming library.
 */
function categoryMatchCandidates(category: string): string[] {
  const trimmed = category.trim();
  const candidates = new Set([trimmed]);
  const stemmed = trimmed.replace(/(ing|ies|es|s)$/i, "");
  if (stemmed.length >= 3 && stemmed !== trimmed) candidates.add(stemmed);
  return Array.from(candidates);
}

export interface ListLeadsParams {
  /**
   * Exact id of a LeadSearch — when given, results are exactly what that
   * search found (via Lead.lastSearchId), and category/location are ignored
   * entirely since they'd otherwise re-filter an already-exact result set
   * through the same fuzzy text matching this was built to avoid.
   */
  searchId?: string;
  category?: string;
  /** Free-text location as typed in the search form (e.g. "Austin, TX") — matched against city/state/country. */
  location?: string;
  minRating?: number;
  minReviews?: number;
  /** true = has a website, false = no website, undefined = both */
  hasWebsite?: boolean;
  /** true = has an enriched email on file, false = no email found, undefined = both */
  hasEmail?: boolean;
  /** true = restrict to leads whose email passed the MX check — implies hasEmail */
  emailValid?: boolean;
  search?: string;
  sortBy?: LeadSortColumn;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ListLeadsResult {
  leads: LeadWithAudit[];
  total: number;
  page: number;
  pageSize: number;
}

function buildLeadWhere(params: Omit<ListLeadsParams, "sortBy" | "sortDirection" | "page" | "pageSize">): Prisma.LeadWhereInput {
  const { searchId, category, location, minRating, minReviews, hasWebsite, hasEmail, emailValid, search } = params;

  const where: Prisma.LeadWhereInput = {};
  // Accumulated separately from `where.OR` (already used by category matching
  // below) so each of these narrows the result set independently instead of
  // merging into one flat OR — every entry here must ALL match.
  const andConditions: Prisma.LeadWhereInput[] = [];

  if (searchId) {
    where.lastSearchId = searchId;
  } else {
    if (category) {
      where.OR = categoryMatchCandidates(category).map((c) => ({
        category: { contains: c, mode: "insensitive" as const },
      }));
    }
    if (location) {
      // Free text like "Austin, TX" — every comma-separated token must match
      // somewhere in city/state/country, so a two-part location narrows
      // correctly instead of a single token (e.g. a stray "TX") over-matching.
      const tokens = location.split(",").map((t) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        andConditions.push({
          OR: [
            { city: { contains: token, mode: "insensitive" as const } },
            { state: { contains: token, mode: "insensitive" as const } },
            { country: { contains: token, mode: "insensitive" as const } },
          ],
        });
      }
    }
  }
  if (minRating !== undefined) where.rating = { gte: minRating };
  if (minReviews !== undefined) where.reviewCount = { gte: minReviews };
  if (hasWebsite === true) where.website = { not: null };
  if (hasWebsite === false) where.website = null;
  if (hasEmail === true) where.enrichedEmail = { not: null };
  if (hasEmail === false) where.enrichedEmail = null;
  if (emailValid === true) where.enrichedEmailValid = true;
  if (search) {
    // Matches by name OR website — someone pasting in a URL should find the
    // business by it, not just by typing its name.
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { website: { contains: search, mode: "insensitive" as const } },
      ],
    });
  }

  if (andConditions.length > 0) where.AND = andConditions;

  return where;
}

/**
 * "email" isn't a real Lead column (it's enrichedEmail) and, being nullable,
 * needs nulls pinned last in both directions — businesses with an email
 * found should always surface above ones without, regardless of A-Z/Z-A.
 * MX-verified emails are also ranked ahead of unverified ones first, so
 * sorting by email surfaces working addresses before alphabetizing.
 */
function buildLeadOrderBy(
  sortBy: LeadSortColumn,
  sortDirection: "asc" | "desc",
): Prisma.LeadOrderByWithRelationInput | Prisma.LeadOrderByWithRelationInput[] {
  if (sortBy === "email") {
    return [{ enrichedEmailValid: "desc" }, { enrichedEmail: { sort: sortDirection, nulls: "last" } }];
  }
  return { [sortBy]: sortDirection };
}

export async function listLeads(params: ListLeadsParams = {}): Promise<ListLeadsResult> {
  const { sortBy = "opportunityScore", sortDirection = "desc", page = 1, pageSize = 25 } = params;
  const where = buildLeadWhere(params);
  const orderBy = buildLeadOrderBy(sortBy, sortDirection);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { audit: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, pageSize };
}

const LEAD_ID_LIST_CAP = 300;

/**
 * Just the ids, in the same order `listLeads` would return them, unpaginated
 * (up to a safety cap) — powers Previous/Next navigation on the lead detail
 * page without re-fetching every lead's full record.
 */
export async function listLeadIds(params: Omit<ListLeadsParams, "page" | "pageSize"> = {}): Promise<string[]> {
  const { sortBy = "opportunityScore", sortDirection = "desc" } = params;
  const where = buildLeadWhere(params);
  const orderBy = buildLeadOrderBy(sortBy, sortDirection);

  const rows = await prisma.lead.findMany({ where, orderBy, select: { id: true }, take: LEAD_ID_LIST_CAP });
  return rows.map((r) => r.id);
}

export async function getLeadById(id: string): Promise<LeadWithAudit | null> {
  return prisma.lead.findUnique({ where: { id }, include: { audit: true } });
}

/**
 * Upserts by googlePlaceId; existing opportunityScore is untouched (recomputed separately by services/audit.ts).
 * When `lastSearchId` is given, every upserted row is tagged with it — this is what lets the results
 * table show exactly what this search found, instead of re-deriving it via fuzzy text matching.
 */
export async function upsertLeads(businesses: MappedBusiness[], lastSearchId?: string): Promise<Lead[]> {
  if (businesses.length === 0) return [];

  return prisma.$transaction(
    businesses.map((business) => {
      const fields = {
        name: business.name,
        category: business.category,
        businessStatus: business.businessStatus,
        phone: business.phone,
        website: business.website,
        rating: business.rating,
        reviewCount: business.reviewCount,
        address: business.address,
        city: business.city,
        state: business.state,
        country: business.country,
        lat: business.lat,
        lng: business.lng,
        ...(lastSearchId ? { lastSearchId } : {}),
      };

      return prisma.lead.upsert({
        where: { googlePlaceId: business.googlePlaceId },
        create: { googlePlaceId: business.googlePlaceId, ...fields },
        update: fields,
      });
    }),
  );
}
