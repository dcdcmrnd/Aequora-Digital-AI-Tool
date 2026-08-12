import { hasMxRecord } from "@/lib/emailVerification";
import { assertPublicHttpUrl, fetchHtml } from "@/lib/leads/webFetch";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const SUBPAGE_LINK_PATTERN = /about|team|staff|leadership|our-team|meet-the-team|people|management|company|contact/i;
const MAX_SUBPAGES = 4;
const SUBPAGE_FETCH_CONCURRENCY = 3;

// Anchors the name+title extraction below to a known vocabulary rather than
// matching any capitalized phrase near a name -- without a DOM parser to
// isolate actual team-member cards, unconstrained matching against a page's
// flowing marketing copy produces mostly noise. This is the always-included
// base; buildTitlePatterns() below unions it with whatever extra title terms
// a given call cares about (e.g. a People Search's searched Position), since
// a term outside this list would otherwise never even get extracted from a
// page, regardless of any later match-flagging logic.
const TITLE_VOCABULARY = [
  "Managing Director", "Executive Director", "Operations Director", "Operations Manager",
  "Head of Operations", "Office Manager", "General Manager", "Business Owner",
  "Co-Founder", "Co-Owner", "Vice President", "Founder", "President", "Director",
  "Owner", "Proprietor", "Partner", "Principal", "Chairman", "Chairwoman", "Chair",
  "CEO", "CFO", "COO", "CTO",
];
const NAME_TOKEN = "[A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2}";

interface TitlePatterns {
  nameThenTitle: RegExp;
  titleThenName: RegExp;
}

/**
 * Builds the name+title extraction regexes for one crawl call, unioning the
 * base TITLE_VOCABULARY with any extra terms (escaped, deduped, empty
 * entries dropped -- an empty alternation branch would match everywhere).
 *
 * No "i" flag on the combined regexes: NAME_TOKEN's [A-Z][a-z]+ shape is
 * exactly what tells a real name apart from ordinary lowercase prose, and
 * the "i" flag makes [A-Z] match lowercase too -- an earlier version of this
 * file had it, which let plain sentence text after a title (e.g. "Founder:
 * John Smith runs daily operations") get swept up as part of the "name".
 * Real team-page titles are essentially always Title Case anyway, so the
 * title vocabulary still matches the common case without case-insensitivity.
 */
function buildTitlePatterns(extraTitles: string[]): TitlePatterns {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of [...TITLE_VOCABULARY, ...extraTitles]) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }

  // Non-capturing group: this gets embedded inside another capturing group
  // below (once for nameThenTitle, once for titleThenName) -- if this
  // alternation captured too, it would shift every group index after it,
  // silently misassigning which match[] slot is the name.
  const titlePattern = `\\b(?:${terms.join("|")})\\b`;

  return {
    // "Jane Doe, Founder" / "Jane Doe - Founder" / "Jane Doe | Founder"
    nameThenTitle: new RegExp(`(${NAME_TOKEN})\\s*[,\\-\\u2013\\u2014|]\\s*(${titlePattern})`, "g"),
    // "Founder: Jane Doe" / "Founder - Jane Doe" (title-first card layouts)
    titleThenName: new RegExp(`(${titlePattern})\\s*[:\\-\\u2013\\u2014|]\\s*(${NAME_TOKEN})`, "g"),
  };
}

const GENERIC_EMAIL_LOCAL_PARTS = new Set([
  "info", "contact", "support", "sales", "admin", "hello", "help", "office",
  "inquiries", "inquiry", "enquiries", "enquiry", "service", "services", "team",
  "marketing", "hr", "careers", "jobs", "billing", "accounts", "noreply",
  "no-reply", "donotreply", "webmaster", "mail", "general", "press", "media",
]);

export type EmailSource = "scraped" | "pattern_guess";
export type PersonConfidence = "high" | "medium" | "low";

export interface FoundPerson {
  name: string;
  title: string | null;
  matchesIcpTitle: boolean;
  email: string | null;
  emailSource: EmailSource | null;
  emailValid: boolean | null;
  phone: string | null;
  confidence: PersonConfidence;
  foundOnUrl: string;
}

interface RawCandidate {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  foundOnUrl: string;
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function trimTrailingPunctuation(raw: string): string {
  return raw.replace(/[),.]+$/, "");
}

function extractJsonLdPeople(html: string, pageUrl: string): RawCandidate[] {
  const found: RawCandidate[] = [];
  for (const scriptMatch of Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  )) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const people = [
          ...(entry?.["@type"] === "Person" ? [entry] : []),
          ...(Array.isArray(entry?.employee) ? entry.employee : []),
          ...(Array.isArray(entry?.member) ? entry.member : []),
        ];
        for (const person of people) {
          if (typeof person?.name !== "string") continue;
          found.push({
            name: person.name.trim(),
            title: typeof person.jobTitle === "string" ? person.jobTitle.trim() : null,
            email: typeof person.email === "string" ? person.email.replace(/^mailto:/i, "").trim().toLowerCase() : null,
            phone: typeof person.telephone === "string" ? person.telephone.trim() : null,
            foundOnUrl: pageUrl,
          });
        }
      }
    } catch {
      // Malformed/non-JSON structured data — skip it.
    }
  }
  return found;
}

/** Finds a mailto:/tel: link within a character window of a raw-HTML index — best-effort proxy for "this contact info belongs to this name" without a DOM parser. */
function findNearbyLink(html: string, index: number, protocol: "mailto" | "tel"): string | null {
  const windowStart = Math.max(0, index - 300);
  const windowEnd = Math.min(html.length, index + 300);
  const nearby = html.slice(windowStart, windowEnd);
  const pattern = new RegExp(`${protocol}:([^"'?\\s]+)`, "i");
  const match = nearby.match(pattern);
  if (!match) return null;
  const value = decodeURIComponent(match[1]).trim();
  return protocol === "mailto" ? value.toLowerCase() : value;
}

function extractTextPatternPeople(html: string, pageUrl: string, patterns: TitlePatterns): RawCandidate[] {
  const text = html.replace(/<[^>]+>/g, " ");
  const found: RawCandidate[] = [];

  for (const match of Array.from(text.matchAll(patterns.nameThenTitle))) {
    if (match.index === undefined) continue;
    found.push({
      name: match[1].trim(),
      title: match[2].trim(),
      email: findNearbyLink(html, match.index, "mailto"),
      phone: findNearbyLink(html, match.index, "tel"),
      foundOnUrl: pageUrl,
    });
  }
  for (const match of Array.from(text.matchAll(patterns.titleThenName))) {
    if (match.index === undefined) continue;
    found.push({
      name: match[2].trim(),
      title: match[1].trim(),
      email: findNearbyLink(html, match.index, "mailto"),
      phone: findNearbyLink(html, match.index, "tel"),
      foundOnUrl: pageUrl,
    });
  }

  return found;
}

function extractSubpageLinks(html: string, baseUrl: URL): URL[] {
  const links = new Map<string, URL>();
  for (const match of Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"'#?]+)["']/gi))) {
    if (!SUBPAGE_LINK_PATTERN.test(match[1])) continue;
    try {
      const resolved = new URL(match[1], baseUrl);
      if (resolved.hostname !== baseUrl.hostname) continue;
      if (resolved.pathname === baseUrl.pathname) continue;
      links.set(resolved.pathname, resolved);
    } catch {
      // Malformed href — skip it.
    }
  }
  return Array.from(links.values()).slice(0, MAX_SUBPAGES);
}

/** Merges candidates found across pages by normalized name, keeping the most complete record and its first-seen page. */
function mergeCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const byName = new Map<string, RawCandidate>();
  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, candidate);
      continue;
    }
    byName.set(key, {
      name: existing.name,
      title: existing.title ?? candidate.title,
      email: existing.email ?? candidate.email,
      phone: existing.phone ?? candidate.phone,
      foundOnUrl: existing.foundOnUrl,
    });
  }
  return Array.from(byName.values());
}

/** Detects the local-part pattern of a directly-scraped personal email relative to its owner's name, e.g. "jane.doe" for Jane Doe -> "first.last". Returns a function that applies the same pattern to a new name, or null if no personal (non-generic) email was found to learn from. */
function detectEmailPatternFn(candidates: RawCandidate[]): ((first: string, last: string) => string) | null {
  for (const candidate of candidates) {
    if (!candidate.email) continue;
    const [localPart] = candidate.email.split("@");
    if (!localPart || GENERIC_EMAIL_LOCAL_PARTS.has(localPart.toLowerCase())) continue;
    const nameParts = candidate.name.trim().split(/\s+/);
    if (nameParts.length < 2) continue;
    const first = nameParts[0].toLowerCase();
    const last = nameParts[nameParts.length - 1].toLowerCase();
    const local = localPart.toLowerCase();

    if (local === `${first}.${last}`) return (f, l) => `${f.toLowerCase()}.${l.toLowerCase()}`;
    if (local === `${first[0]}${last}`) return (f, l) => `${f[0].toLowerCase()}${l.toLowerCase()}`;
    if (local === `${first}${last}`) return (f, l) => `${f.toLowerCase()}${l.toLowerCase()}`;
    if (local === `${last}.${first}`) return (f, l) => `${l.toLowerCase()}.${f.toLowerCase()}`;
    if (local === first) return (f) => f.toLowerCase();
  }
  return null;
}

async function resolveEmailForCandidate(
  candidate: RawCandidate,
  domain: string,
  patternFn: ((first: string, last: string) => string) | null,
): Promise<Pick<FoundPerson, "email" | "emailSource" | "emailValid" | "confidence">> {
  if (candidate.email) {
    const [, emailDomain] = candidate.email.split("@");
    const valid = emailDomain ? await hasMxRecord(emailDomain) : false;
    return { email: candidate.email, emailSource: "scraped", emailValid: valid, confidence: "high" };
  }

  const nameParts = candidate.name.trim().split(/\s+/);
  if (nameParts.length < 2) return { email: null, emailSource: null, emailValid: null, confidence: "low" };
  const [first, last] = [nameParts[0], nameParts[nameParts.length - 1]];

  const localPart = patternFn ? patternFn(first, last) : `${first.toLowerCase()}.${last.toLowerCase()}`;
  const guessedEmail = `${localPart}@${domain}`;
  const valid = await hasMxRecord(domain);
  return {
    email: guessedEmail,
    emailSource: "pattern_guess",
    emailValid: valid,
    confidence: patternFn && valid ? "medium" : "low",
  };
}

/**
 * Crawls a lead's website (homepage + up to MAX_SUBPAGES linked About/Team/
 * Contact-style pages on the same host) for named decision-makers, using
 * structured data and title-vocabulary-anchored text patterns to find
 * multiple people per site (unlike leadEnrichment's single best-guess owner).
 * Names found without a direct email get a pattern-guessed one, verified
 * only at the domain (MX) level -- never presented as equal confidence to a
 * directly-scraped address.
 */
export async function findPeopleFromWebsite(websiteUrl: string, icpTitles: string[]): Promise<FoundPerson[]> {
  const baseUrl = await assertPublicHttpUrl(websiteUrl);
  const homeHtml = await fetchHtml(baseUrl);

  const subpageUrls = extractSubpageLinks(homeHtml, baseUrl);
  const subpageResults = await mapWithConcurrency(subpageUrls, SUBPAGE_FETCH_CONCURRENCY, async (url) => {
    try {
      await assertPublicHttpUrl(url.toString());
      const html = await fetchHtml(url);
      return { url, html };
    } catch {
      return null; // Subpage missing/blocked -- skip it, keep the rest of the crawl going.
    }
  });

  const pages = [{ url: baseUrl, html: homeHtml }, ...subpageResults.filter((r): r is { url: URL; html: string } => r !== null)];

  // icpTitles also drives extraction here (not just the matchesIcpTitle flag
  // below) -- a title outside the base TITLE_VOCABULARY, like a People
  // Search's searched Position, would otherwise never be recognized on the
  // page at all.
  const titlePatterns = buildTitlePatterns(icpTitles);
  const allCandidates = pages.flatMap(({ url, html }) => [
    ...extractJsonLdPeople(html, url.toString()),
    ...extractTextPatternPeople(html, url.toString(), titlePatterns),
  ]);
  const merged = mergeCandidates(allCandidates);
  const patternFn = detectEmailPatternFn(allCandidates);
  const lowerIcpTitles = icpTitles.map((t) => t.toLowerCase());

  return Promise.all(
    merged.map(async (candidate) => {
      const emailResult = await resolveEmailForCandidate(candidate, baseUrl.hostname, patternFn);
      const title = candidate.title ? trimTrailingPunctuation(candidate.title) : null;
      return {
        name: candidate.name,
        title,
        matchesIcpTitle: title ? lowerIcpTitles.some((t) => title.toLowerCase().includes(t)) : false,
        phone: candidate.phone,
        foundOnUrl: candidate.foundOnUrl,
        ...emailResult,
      };
    }),
  );
}
