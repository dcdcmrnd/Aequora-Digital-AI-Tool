const REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs?limit=500";
// Remotive's API docs ask callers to hit this endpoint at most ~4x/day --
// fetching the full unfiltered list once per window and filtering every
// user's search against the cached copy keeps this app well under that
// regardless of how many searches run. Best-effort only: a serverless cold
// start clears this, so it's not a hard guarantee, just a real reduction.
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// Application-tracking/job-board domains that regularly show up as the
// first link in a Remotive description -- crawling one of these for "team"
// pages would find the ATS vendor's own staff, not the hiring company's, so
// they're excluded from company-website extraction rather than trusted.
const EXCLUDED_LINK_HOSTS = new Set([
  "remotive.com", "remoteok.com", "arbeitnow.com", "weworkremotely.com",
  "greenhouse.io", "boards.greenhouse.io", "lever.co", "jobs.lever.co",
  "workable.com", "apply.workable.com", "bamboohr.com", "breezy.hr",
  "jobvite.com", "smartrecruiters.com", "icims.com", "ashbyhq.com",
  "jobs.ashbyhq.com", "personio.com", "recruitee.com", "myworkdayjobs.com",
  "taleo.net", "indeed.com", "linkedin.com", "angel.co", "wellfound.com",
  "glassdoor.com", "ziprecruiter.com", "monster.com", "twitter.com", "x.com",
  "facebook.com", "instagram.com",
]);

interface RemotiveApiJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  publication_date: string;
  candidate_required_location: string;
  description: string;
}

export interface RemoteJobListing {
  source: "remotive";
  externalId: string;
  companyName: string;
  position: string;
  candidateLocation: string | null;
  applyUrl: string;
  /** Best-effort company site pulled from the description -- null if nothing usable was found. */
  companyWebsite: string | null;
}

let cache: { fetchedAt: number; jobs: RemotiveApiJob[] } | null = null;

async function fetchRemotiveJobs(): Promise<RemotiveApiJob[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.jobs;

  const res = await fetch(REMOTIVE_API_URL, { headers: { "User-Agent": "AequoraLeadBot/1.0" } });
  if (!res.ok) throw new Error(`Remotive API responded with ${res.status}.`);
  const json = (await res.json()) as { jobs?: RemotiveApiJob[] };
  const jobs = json.jobs ?? [];

  cache = { fetchedAt: Date.now(), jobs };
  return jobs;
}

/** First outbound link in a job description that isn't a known ATS/job-board/social domain -- best-effort company site. */
function extractCompanyWebsite(descriptionHtml: string): string | null {
  for (const match of Array.from(descriptionHtml.matchAll(/https?:\/\/([a-z0-9.-]+)[^\s"'<>)]*/gi))) {
    const host = match[1].toLowerCase().replace(/^www\./, "");
    if (EXCLUDED_LINK_HOSTS.has(host)) continue;
    try {
      return new URL(match[0]).origin;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Searches the cached Remotive listing for jobs matching `keyword` (title,
 * category, or tags) and, if given, `locationFilter` as a substring of the
 * source's free-text candidate_required_location. Deduped by company name
 * (case-insensitive), keeping the most recently posted role per company,
 * capped at `limit`.
 */
export async function searchRemoteHiringJobs(
  keyword: string,
  locationFilter: string | undefined,
  limit: number,
): Promise<RemoteJobListing[]> {
  const jobs = await fetchRemotiveJobs();
  const lowerKeyword = keyword.toLowerCase();
  const lowerLocation = locationFilter?.toLowerCase().trim();

  const matched = jobs.filter((job) => {
    const haystack = `${job.title} ${job.category} ${job.tags.join(" ")}`.toLowerCase();
    if (!haystack.includes(lowerKeyword)) return false;
    if (lowerLocation && !job.candidate_required_location.toLowerCase().includes(lowerLocation)) return false;
    return true;
  });

  matched.sort((a, b) => new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime());

  const byCompany = new Map<string, RemotiveApiJob>();
  for (const job of matched) {
    const key = job.company_name.trim().toLowerCase();
    if (!key || byCompany.has(key)) continue;
    byCompany.set(key, job);
    if (byCompany.size >= limit) break;
  }

  return Array.from(byCompany.values()).map((job) => ({
    source: "remotive",
    externalId: String(job.id),
    companyName: job.company_name.trim(),
    position: job.title.trim(),
    candidateLocation: job.candidate_required_location.trim() || null,
    applyUrl: job.url,
    companyWebsite: extractCompanyWebsite(job.description),
  }));
}
