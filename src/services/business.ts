import type { Lead, LeadAudit, Prisma } from "@prisma/client";

import type { MappedBusiness } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export type { Lead, LeadAudit };

export interface LeadWithAudit extends Lead {
  audit: LeadAudit | null;
}

export type LeadSortColumn = "opportunityScore" | "reviewCount" | "rating" | "createdAt";

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

export async function listLeads(params: ListLeadsParams = {}): Promise<ListLeadsResult> {
  const {
    searchId,
    category,
    location,
    minRating,
    minReviews,
    hasWebsite,
    search,
    sortBy = "opportunityScore",
    sortDirection = "desc",
    page = 1,
    pageSize = 25,
  } = params;

  const where: Prisma.LeadWhereInput = {};
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
      if (tokens.length > 0) {
        where.AND = tokens.map((token) => ({
          OR: [
            { city: { contains: token, mode: "insensitive" as const } },
            { state: { contains: token, mode: "insensitive" as const } },
            { country: { contains: token, mode: "insensitive" as const } },
          ],
        }));
      }
    }
  }
  if (minRating !== undefined) where.rating = { gte: minRating };
  if (minReviews !== undefined) where.reviewCount = { gte: minReviews };
  if (hasWebsite === true) where.website = { not: null };
  if (hasWebsite === false) where.website = null;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { audit: true },
      orderBy: { [sortBy]: sortDirection },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, pageSize };
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
