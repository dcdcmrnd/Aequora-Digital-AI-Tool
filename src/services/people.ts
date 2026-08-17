import type { LeadPerson, Prisma } from "@prisma/client";

import { escapeLikePattern } from "@/lib/db";
import type { FoundPerson } from "@/lib/leads/personFinder";
import { normalizeName } from "@/lib/leads/personFinder";
import { prisma } from "@/lib/prisma";
import { type LeadWithAudit, upsertLeads } from "@/services/business";
import { searchBusinesses } from "@/services/google";

const PEOPLE_SEARCH_PAGE_SIZE = 20; // Google's hard per-request cap, same as executeSearch
const PEOPLE_SEARCH_TARGET_RESULTS = 60; // total businesses to gather, before the crawl-cap trims it down

/**
 * Writes crawl results as LeadPerson rows for one lead, updating an existing
 * row (matched case-insensitively by name) instead of duplicating it on a
 * re-crawl. `peopleSearchId` is only stamped on brand-new rows -- an
 * existing person (found manually, or by an earlier search) keeps whichever
 * provenance they were first discovered with even if a later crawl touches
 * their other fields, so a People Search re-crawling a company never
 * silently reclassifies someone already in "Found People".
 *
 * `leadPhone` (the business's own number, already on file from Google
 * Places) fills in for people whose own direct line wasn't found on the
 * site -- better than leaving the column blank when a switchboard number is
 * already known, and still overridden by any tel: link found for them.
 */
export async function upsertFoundPeople(
  leadId: string,
  found: FoundPerson[],
  peopleSearchId?: string,
  leadPhone?: string | null,
): Promise<LeadPerson[]> {
  const existing = await prisma.leadPerson.findMany({ where: { leadId } });
  const existingByName = new Map(existing.map((p) => [normalizeName(p.name ?? ""), p]));

  for (const person of found) {
    const match = existingByName.get(normalizeName(person.name));
    const data = {
      name: person.name,
      title: person.title,
      matchesIcpTitle: person.matchesIcpTitle,
      email: person.email,
      emailSource: person.emailSource,
      emailValid: person.emailValid,
      phone: person.phone ?? leadPhone ?? null,
      source: "website_crawl" as const,
      confidence: person.confidence,
      foundOnUrl: person.foundOnUrl,
    };
    if (match) {
      await prisma.leadPerson.update({ where: { id: match.id }, data });
    } else {
      await prisma.leadPerson.create({ data: { leadId, peopleSearchId, ...data } });
    }
  }

  return prisma.leadPerson.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });
}

export interface DiscoverCompaniesResult {
  leads: LeadWithAudit[];
  searchId: string;
}

/**
 * The company-discovery half of a People Search: the same Google Places
 * search + LeadSearch tagging executeSearch (src/services/search.ts) uses,
 * but deliberately skipping its audit/enrich step -- a PageSpeed audit and
 * single-email scrape are irrelevant to finding decision-makers and would
 * burn into the 60s request budget the crawl step below still needs.
 */
export async function discoverCompaniesForPeopleSearch(
  userId: string,
  industry: string,
  location: string,
): Promise<DiscoverCompaniesResult> {
  const searchRow = await prisma.leadSearch.create({
    data: { userId, keyword: industry, location, radius: 5_000 },
  });

  const mapped = await searchBusinesses({
    keyword: industry,
    location,
    radiusMeters: 5_000,
    maxResults: PEOPLE_SEARCH_PAGE_SIZE,
    targetResults: PEOPLE_SEARCH_TARGET_RESULTS,
  });

  const leads = await upsertLeads(mapped, searchRow.id);
  return { leads: leads.map((lead) => ({ ...lead, audit: null })), searchId: searchRow.id };
}

export interface LeadPersonWithLead extends LeadPerson {
  lead: { id: string; name: string; city: string | null; state: string | null; website: string | null };
}

export type PeopleSortColumn = "createdAt" | "name";

export interface ListPeopleParams {
  search?: string;
  matchesIcpTitle?: boolean;
  hasEmail?: boolean;
  confidence?: string;
  source?: string;
  /**
   * undefined = no filter (all people); null = only people found manually
   * (Company tab's "Find People", not tied to any People Search); a string =
   * only people from that specific People Search. Mirrors how Lead's
   * `searchId` exactly scopes results in listLeads.
   */
  peopleSearchId?: string | null;
  sortBy?: PeopleSortColumn;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ListPeopleResult {
  people: LeadPersonWithLead[];
  total: number;
  page: number;
  pageSize: number;
}

function buildPeopleWhere(params: ListPeopleParams): Prisma.LeadPersonWhereInput {
  const { search, matchesIcpTitle, hasEmail, confidence, source, peopleSearchId } = params;
  const where: Prisma.LeadPersonWhereInput = {};

  if (matchesIcpTitle !== undefined) where.matchesIcpTitle = matchesIcpTitle;
  if (hasEmail === true) where.email = { not: null };
  if (hasEmail === false) where.email = null;
  if (confidence) where.confidence = confidence;
  if (source) where.source = source;
  if (peopleSearchId !== undefined) where.peopleSearchId = peopleSearchId;
  if (search) {
    const pattern = escapeLikePattern(search);
    where.OR = [
      { name: { contains: pattern, mode: "insensitive" } },
      { title: { contains: pattern, mode: "insensitive" } },
      { lead: { name: { contains: pattern, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function listPeople(params: ListPeopleParams = {}): Promise<ListPeopleResult> {
  const { sortBy = "createdAt", sortDirection = "desc", page = 1, pageSize = 25 } = params;
  const where = buildPeopleWhere(params);
  const orderBy: Prisma.LeadPersonOrderByWithRelationInput = { [sortBy]: sortDirection };

  const [people, total] = await Promise.all([
    prisma.leadPerson.findMany({
      where,
      include: { lead: { select: { id: true, name: true, city: true, state: true, website: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leadPerson.count({ where }),
  ]);

  return { people, total, page, pageSize };
}
