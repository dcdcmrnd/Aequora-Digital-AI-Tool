import type { LeadPerson, Prisma } from "@prisma/client";

import type { FoundPerson } from "@/lib/leads/personFinder";
import { normalizeName } from "@/lib/leads/personFinder";
import { prisma } from "@/lib/prisma";

/** Writes crawl results as LeadPerson rows for one lead, updating an existing row (matched case-insensitively by name) instead of duplicating it on a re-crawl. */
export async function upsertFoundPeople(leadId: string, found: FoundPerson[]): Promise<LeadPerson[]> {
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
      phone: person.phone,
      source: "website_crawl" as const,
      confidence: person.confidence,
      foundOnUrl: person.foundOnUrl,
    };
    if (match) {
      await prisma.leadPerson.update({ where: { id: match.id }, data });
    } else {
      await prisma.leadPerson.create({ data: { leadId, ...data } });
    }
  }

  return prisma.leadPerson.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });
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
  const { search, matchesIcpTitle, hasEmail, confidence, source } = params;
  const where: Prisma.LeadPersonWhereInput = {};

  if (matchesIcpTitle !== undefined) where.matchesIcpTitle = matchesIcpTitle;
  if (hasEmail === true) where.email = { not: null };
  if (hasEmail === false) where.email = null;
  if (confidence) where.confidence = confidence;
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { lead: { name: { contains: search, mode: "insensitive" } } },
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
