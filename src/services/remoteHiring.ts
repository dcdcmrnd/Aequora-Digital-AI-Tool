import { DEFAULT_ICP_TITLES } from "@/lib/leads/constants";
import { findPeopleFromWebsite } from "@/lib/leads/personFinder";
import type { RemoteJobListing } from "@/lib/leads/remoteJobBoards";
import { searchRemoteHiringJobs } from "@/lib/leads/remoteJobBoards";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { prisma } from "@/lib/prisma";
import { upsertLeads } from "@/services/business";
import { searchBusinesses } from "@/services/google";
import { upsertFoundPeople } from "@/services/people";

// Same order of magnitude as PeopleSearch's PEOPLE_SEARCH_CRAWL_CAP -- each
// company needs a Places lookup plus a site crawl, so this stays well inside
// the 60s request budget.
const JOBS_CAP = 10;
const CRAWL_CONCURRENCY = 3;

// Remotive's candidate_required_location is often a vague catch-all rather
// than something Google can geo-match against ("Worldwide", "Anywhere") --
// falling back to a real place keeps the Places text query meaningful
// instead of literally searching "Acme Corp in Worldwide".
const VAGUE_LOCATION_PATTERN = /^(worldwide|anywhere|remote|global)$/i;

function placesLocationFor(candidateLocation: string | null): string {
  if (!candidateLocation || VAGUE_LOCATION_PATTERN.test(candidateLocation.trim())) return "United States";
  return candidateLocation;
}

const COMPANY_SUFFIX_PATTERN = /\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|plc|group)\b\.?/gi;

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(COMPANY_SUFFIX_PATTERN, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Loose "is this Places result actually the company we searched for" guard -- Text Search returns its closest textual match even with no real hit, so an unrelated business must not get linked to this job post as if it were confirmed. */
function looksLikeSameCompany(searched: string, found: string): boolean {
  const a = normalizeCompanyName(searched);
  const b = normalizeCompanyName(found);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export interface RemoteHiringSearchResult {
  searchId: string;
  jobsFound: number;
  companiesMatched: number;
  peopleFound: number;
  posts: Awaited<ReturnType<typeof listRemoteHiringPosts>>;
}

/**
 * Finds companies currently hiring remote staff (via Remotive) and, for each,
 * best-effort resolves a real business (Google Places, matched by name) so
 * the existing website-crawl + phone-fallback pipeline can surface an actual
 * person to call -- not just a job listing. A company with no confident
 * Places match still surfaces as a post (name, role, apply link) for manual
 * follow-up, just without a crawled contact.
 */
export async function discoverRemoteHiring(
  userId: string,
  keyword: string,
  locationFilter: string | undefined,
): Promise<RemoteHiringSearchResult> {
  const jobs = await searchRemoteHiringJobs(keyword, locationFilter, JOBS_CAP);

  const peopleSearch = await prisma.peopleSearch.create({
    data: {
      userId,
      position: keyword,
      industry: "Remote hiring (Remotive)",
      location: locationFilter?.trim() || "Any",
      companiesFound: jobs.length,
    },
  });

  let companiesMatched = 0;
  let peopleFound = 0;

  await mapWithConcurrency(jobs, CRAWL_CONCURRENCY, async (job) => {
    const { leadId, website, phone } = await resolveCompany(job);
    if (leadId) companiesMatched += 1;

    await prisma.remoteHiringPost.upsert({
      where: { source_externalId: { source: job.source, externalId: job.externalId } },
      create: {
        peopleSearchId: peopleSearch.id,
        source: job.source,
        externalId: job.externalId,
        companyName: job.companyName,
        position: job.position,
        candidateLocation: job.candidateLocation,
        applyUrl: job.applyUrl,
        companyWebsite: website,
        leadId,
      },
      update: {
        peopleSearchId: peopleSearch.id,
        companyWebsite: website,
        leadId,
      },
    });

    if (!leadId || !website) return;

    try {
      const found = await findPeopleFromWebsite(website, [job.position, ...DEFAULT_ICP_TITLES]);
      const people = await upsertFoundPeople(leadId, found, peopleSearch.id, phone);
      peopleFound += people.length;
    } catch {
      // Site unreachable/blocked -- the post still stands on its own.
    }
  });

  await prisma.peopleSearch.update({ where: { id: peopleSearch.id }, data: { companiesCrawled: companiesMatched } });

  const posts = await listRemoteHiringPosts(peopleSearch.id);
  return { searchId: peopleSearch.id, jobsFound: jobs.length, companiesMatched, peopleFound, posts };
}

async function resolveCompany(job: RemoteJobListing): Promise<{ leadId: string | null; website: string | null; phone: string | null }> {
  const matches = await searchBusinesses({
    keyword: job.companyName,
    location: placesLocationFor(job.candidateLocation),
    radiusMeters: 5_000,
    maxResults: 5,
    targetResults: 5,
  }).catch(() => []);

  const match = matches.find((m) => looksLikeSameCompany(job.companyName, m.name));
  if (!match) {
    return { leadId: null, website: job.companyWebsite, phone: null };
  }

  const [lead] = await upsertLeads([match]);
  return { leadId: lead.id, website: match.website ?? job.companyWebsite, phone: match.phone };
}

export async function listRemoteHiringPosts(peopleSearchId: string) {
  return prisma.remoteHiringPost.findMany({
    where: { peopleSearchId },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          website: true,
          people: { where: { peopleSearchId }, orderBy: { createdAt: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
