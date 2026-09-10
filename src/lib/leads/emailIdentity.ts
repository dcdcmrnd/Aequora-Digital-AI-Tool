import { isValidEmailSyntax, verifyEmail, type EmailVerificationStatus } from "@/lib/emailVerification";
import { findPeopleFromWebsite, type FoundPerson } from "@/lib/leads/personFinder";
import { assertPublicHttpUrl, fetchHtml } from "@/lib/leads/webFetch";

export interface EmailIdentityResult {
  email: string;
  domain: string;
  /** Domain-level only (MX record check) -- confirms the domain can receive mail, not that this specific mailbox is live. See emailVerification.ts. */
  verification: EmailVerificationStatus;
  company: { name: string | null; url: string } | null;
  /** The person on the company's site whose email matched, if any -- null means no match, not "no such person". */
  person: FoundPerson | null;
}

const OG_SITE_NAME_PATTERN = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i;
const TITLE_TAG_PATTERN = /<title[^>]*>([^<]+)<\/title>/i;
// Trims a common "Page Title - Company Name" / "Company Name | Tagline" suffix pattern down to
// just the company name half -- <title> tags are the least reliable source here (freeform copy,
// not structured data), so this only kicks in when nothing more reliable was found.
const TITLE_SEPARATOR_PATTERN = /\s+[|–—-]\s+/;

function extractOrganizationName(html: string): string | null {
  for (const scriptMatch of Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (
          (entry?.["@type"] === "Organization" || entry?.["@type"] === "Corporation" || entry?.["@type"] === "LocalBusiness") &&
          typeof entry.name === "string" &&
          entry.name.trim()
        ) {
          return entry.name.trim();
        }
      }
    } catch {
      // Malformed/non-JSON structured data -- skip it.
    }
  }

  const ogMatch = html.match(OG_SITE_NAME_PATTERN);
  if (ogMatch) return ogMatch[1].trim();

  const titleMatch = html.match(TITLE_TAG_PATTERN);
  if (titleMatch) {
    const raw = titleMatch[1].trim();
    const firstSegment = raw.split(TITLE_SEPARATOR_PATTERN)[0].trim();
    return firstSegment || raw || null;
  }

  return null;
}

async function fetchCompanySite(domain: string): Promise<{ url: URL; html: string } | null> {
  for (const candidate of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const url = await assertPublicHttpUrl(candidate);
      const html = await fetchHtml(url);
      return { url, html };
    } catch {
      // Try the next candidate -- unreachable/blocked hosts are common and expected.
    }
  }
  return null;
}

/**
 * Given a bare email address, verifies domain-level deliverability, then
 * (best-effort) identifies the company behind the domain and, if a matching
 * person can be found on that company's own site, their name and title.
 *
 * No paid enrichment API involved: this only reuses what personFinder/
 * leadEnrichment already do for company websites (crawl, structured data +
 * title-vocabulary text matching), applied in reverse -- from an email
 * inward instead of from a website outward. If nobody found on the site's
 * team/about pages has a matching email, person comes back null rather than
 * a guessed name; a wrong guess is worse than no answer here.
 */
export async function identifyEmail(rawEmail: string): Promise<EmailIdentityResult> {
  const email = rawEmail.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";

  if (!isValidEmailSyntax(email) || !domain) {
    return { email, domain, verification: "invalid", company: null, person: null };
  }

  const verification = await verifyEmail(email);
  if (verification === "invalid") {
    return { email, domain, verification, company: null, person: null };
  }

  const site = await fetchCompanySite(domain);
  if (!site) {
    return { email, domain, verification, company: null, person: null };
  }

  const companyName = extractOrganizationName(site.html);
  const company = { name: companyName, url: site.url.toString() };

  let person: FoundPerson | null = null;
  try {
    const found = await findPeopleFromWebsite(site.url.toString(), []);
    person = found.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
  } catch {
    // Crawl failed after the homepage fetch already succeeded (e.g. a subpage
    // timing out) -- still return the company we found rather than nothing.
  }

  return { email, domain, verification, company, person };
}
