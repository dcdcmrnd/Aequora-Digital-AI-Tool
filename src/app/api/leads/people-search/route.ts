import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { DEFAULT_ICP_TITLES } from "@/lib/leads/constants";
import { findPeopleFromWebsite } from "@/lib/leads/personFinder";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { discoverCompaniesForPeopleSearch, listPeople, upsertFoundPeople } from "@/services/people";

// Auto-crawling ~10 businesses at concurrency 3 (each up to ~8-24s, same
// per-lead cost as bulk-find-people) is what fits a Places search plus the
// crawl itself inside Vercel Hobby's 60s ceiling in one request -- there's
// no background-job infrastructure in this app to spread the work across
// multiple invocations, so the cap is a hard, disclosed tradeoff rather than
// a soft default. See bulk-find-people/route.ts for the same reasoning.
const PEOPLE_SEARCH_CRAWL_CAP = 10;
const CRAWL_CONCURRENCY = 3;

export const maxDuration = 60;

const schema = z.object({
  position: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  location: z.string().trim().min(1),
});

/**
 * Auto-discovers people by Position + Industry + Location: runs a Google
 * Places search for the industry/location (same mechanism as the Company
 * tab, producing real Lead/LeadSearch rows), then crawls the first
 * PEOPLE_SEARCH_CRAWL_CAP results with a website for people matching
 * Position. Results are tagged with a PeopleSearch row (LeadPerson.peopleSearchId)
 * so they stay separate from people found manually via "Find People" on the
 * Company tab (which leaves peopleSearchId null).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Position, industry, and location are all required." }, { status: 400 });
  const { position, industry, location } = parsed.data;

  const { leads } = await discoverCompaniesForPeopleSearch(session.user.id, industry, location);
  const toCrawl = leads.filter((lead) => lead.website).slice(0, PEOPLE_SEARCH_CRAWL_CAP);

  const peopleSearch = await prisma.peopleSearch.create({
    data: {
      userId: session.user.id,
      position,
      industry,
      location,
      companiesFound: leads.length,
      companiesCrawled: toCrawl.length,
    },
  });

  const titleTerms = [position, ...DEFAULT_ICP_TITLES];
  let failed = 0;
  await mapWithConcurrency(toCrawl, CRAWL_CONCURRENCY, async (lead) => {
    try {
      const found = await findPeopleFromWebsite(lead.website!, titleTerms);
      await upsertFoundPeople(lead.id, found, peopleSearch.id);
    } catch {
      failed += 1;
    }
  });

  const { people } = await listPeople({ peopleSearchId: peopleSearch.id, pageSize: 200 });

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "people_search",
    entityId: peopleSearch.id,
    entityName: `${position} in ${industry} — ${location}`,
    metadata: { companiesFound: leads.length, companiesCrawled: toCrawl.length, peopleFound: people.length, failed },
  });

  return NextResponse.json({
    searchId: peopleSearch.id,
    companiesFound: leads.length,
    companiesCrawled: toCrawl.length,
    people,
  });
}
