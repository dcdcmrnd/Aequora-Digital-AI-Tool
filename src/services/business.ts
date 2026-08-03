import type { Lead, LeadAudit, Prisma } from "@prisma/client";

import type { MappedBusiness } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export type { Lead, LeadAudit };

export interface LeadWithAudit extends Lead {
  audit: LeadAudit | null;
}

export type LeadSortColumn = "opportunityScore" | "reviewCount" | "rating" | "createdAt";

export interface ListLeadsParams {
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
  if (category) where.category = { contains: category, mode: "insensitive" };
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

  if (process.env.DEBUG_LEADS === "1") {
    const categoryOnly = category
      ? await prisma.lead.findMany({
          where: { category: { contains: category, mode: "insensitive" } },
          select: { name: true, category: true, city: true, state: true, country: true },
          take: 20,
        })
      : [];
    console.log("[DEBUG_LEADS] params:", JSON.stringify({ category, location }));
    console.log("[DEBUG_LEADS] where:", JSON.stringify(where));
    console.log("[DEBUG_LEADS] total with full filter:", total);
    console.log("[DEBUG_LEADS] category-only matches:", JSON.stringify(categoryOnly, null, 2));
  }

  return { leads, total, page, pageSize };
}

export async function getLeadById(id: string): Promise<LeadWithAudit | null> {
  return prisma.lead.findUnique({ where: { id }, include: { audit: true } });
}

/** Upserts by googlePlaceId; existing opportunityScore is untouched (recomputed separately by services/audit.ts). */
export async function upsertLeads(businesses: MappedBusiness[]): Promise<Lead[]> {
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
      };

      return prisma.lead.upsert({
        where: { googlePlaceId: business.googlePlaceId },
        create: { googlePlaceId: business.googlePlaceId, ...fields },
        update: fields,
      });
    }),
  );
}
