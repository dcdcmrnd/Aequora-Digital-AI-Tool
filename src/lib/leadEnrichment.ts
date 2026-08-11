import { promises as dns } from "dns";
import net from "net";

import { hasMxRecord } from "@/lib/emailVerification";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 500_000;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
  }
  return false;
}

/** Rejects anything that isn't a plain public http(s) URL, to keep a server-side fetch of a lead's website from being usable against internal/private addresses. */
async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported.");
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (addresses.length === 0) throw new Error("Could not resolve the website's hostname.");
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("Refusing to fetch a private or internal address.");
  }
  return url;
}

export interface LeadEnrichmentResult {
  email: string | null;
  /** Best-effort MX lookup on the chosen email's domain. null = no email found to check. */
  emailValid: boolean | null;
  /**
   * Best-effort owner/founder name, from the website's own "Owner:"/
   * "Founder:" text or structured data when present, otherwise guessed from
   * a personal-looking (non-generic) email local part. Most small-business
   * sites expose neither, so this is frequently null — not every business
   * has a discoverable owner name, and no guess is better than a wrong one.
   */
  ownerName: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
}

// Any subdomain is allowed (not just "www.") so this also catches regional
// mirrors (de.linkedin.com), mobile links (m.facebook.com), and LinkedIn
// paths beyond /company/ and /in/ (e.g. /showcase/, /school/).
const SOCIAL_PATTERNS: { key: "facebookUrl" | "instagramUrl" | "linkedinUrl" | "twitterUrl"; regex: RegExp }[] = [
  { key: "facebookUrl", regex: /https?:\/\/(?:[a-z0-9-]+\.)?(?:facebook|fb)\.com\/[^\s"'<>)]+/i },
  { key: "instagramUrl", regex: /https?:\/\/(?:[a-z0-9-]+\.)?instagram\.com\/[^\s"'<>)]+/i },
  { key: "linkedinUrl", regex: /https?:\/\/(?:[a-z0-9-]+\.)?linkedin\.com\/[^\s"'<>)]+/i },
  { key: "twitterUrl", regex: /https?:\/\/(?:[a-z0-9-]+\.)?(?:twitter|x)\.com\/[^\s"'<>)]+/i },
];

// Role-based inboxes rarely reach a specific person — deprioritized below
// generic addresses in favor of anything that looks like an actual name.
const GENERIC_EMAIL_LOCAL_PARTS = new Set([
  "info", "contact", "support", "sales", "admin", "hello", "help", "office",
  "inquiries", "inquiry", "enquiries", "enquiry", "service", "services", "team",
  "marketing", "hr", "careers", "jobs", "billing", "accounts", "noreply",
  "no-reply", "donotreply", "webmaster", "mail", "general", "press", "media",
]);

function isGenericLocalPart(localPart: string): boolean {
  return GENERIC_EMAIL_LOCAL_PARTS.has(localPart.toLowerCase());
}

/**
 * "john.smith" / "john_smith" -> "John Smith". A single clean word (e.g.
 * "mike@...") is still useful as a first-name-only guess. Anything generic,
 * or with more than two parts (more likely a role/product name than a
 * person), returns null rather than a bad guess.
 */
function guessOwnerName(localPart: string): string | null {
  if (isGenericLocalPart(localPart)) return null;
  const parts = localPart.split(/[._-]/).filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || !parts.every((p) => /^[a-z]{3,}$/i.test(p))) return null;
  return parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}

// Matches "Owner: Jane Doe", "Founded by Jane Doe", "Meet our founder, Jane
// Doe", etc. Keyword matching is case-insensitive (site copy is inconsistently
// capitalized) but kept separate from the name capture, which deliberately
// isn't — a lowercase "owner: jane doe" is more likely a sentence fragment
// than an actual name, so only a properly-capitalized name after the keyword
// counts as a match. Capped at 3 words so it doesn't sweep up a trailing
// sentence fragment.
const OWNER_KEYWORD_PATTERN = /\b(?:owner|founder|proprietor|founded by|owned by)\b/i;
const OWNER_NAME_PATTERN = /^[^A-Za-z]{0,20}([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/;

/**
 * Best-effort owner-name scrape of a website's own HTML — schema.org
 * structured data first (most reliable when present), then a plain-text
 * "Owner:"/"Founder:" pattern match. Most small-business sites have neither,
 * so this often finds nothing; that's expected, not a bug.
 */
function guessOwnerNameFromHtml(html: string): string | null {
  for (const scriptMatch of Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (entry?.["@type"] === "Person" && typeof entry.name === "string") return entry.name.trim();
        if (typeof entry?.founder?.name === "string") return entry.founder.name.trim();
      }
    } catch {
      // Malformed/non-JSON structured data on the page — skip it.
    }
  }

  const text = html.replace(/<[^>]+>/g, " ");
  const keywordMatch = text.match(OWNER_KEYWORD_PATTERN);
  if (!keywordMatch || keywordMatch.index === undefined) return null;
  const after = text.slice(keywordMatch.index + keywordMatch[0].length, keywordMatch.index + keywordMatch[0].length + 40);
  const nameMatch = after.match(OWNER_NAME_PATTERN);
  return nameMatch ? nameMatch[1].trim() : null;
}

/** Personal-looking addresses first (more likely to reach an actual owner), generic role addresses last; ties keep page order. */
function pickBestEmail(emails: string[]): string | null {
  if (emails.length === 0) return null;
  const ranked = emails
    .map((email, index) => ({ email, index, generic: isGenericLocalPart(email.split("@")[0] ?? "") }))
    .sort((a, b) => Number(a.generic) - Number(b.generic) || a.index - b.index);
  return ranked[0].email;
}

function trimTrailingPunctuation(raw: string): string {
  return raw.replace(/[),.]+$/, "");
}

async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AequoraLeadBot/1.0; +https://aequoradigital.com)" },
    });
    if (!res.ok) throw new Error(`Website responded with ${res.status}.`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("Website did not return an HTML page.");
    }

    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches a lead's website and scans it for a contact email (preferring a
 * personal-looking address over a role inbox, MX-checked so obviously dead
 * domains don't get surfaced as real leads) and social profile links.
 */
export async function enrichFromWebsite(websiteUrl: string): Promise<LeadEnrichmentResult> {
  const url = await assertPublicHttpUrl(websiteUrl);
  const html = await fetchHtml(url);

  const candidateEmails = Array.from(html.matchAll(/mailto:([^"'?\s]+)/gi))
    .map((m) => decodeURIComponent(m[1]).trim().toLowerCase())
    .filter((e) => e.includes("@"));
  const email = pickBestEmail(Array.from(new Set(candidateEmails)));

  let emailValid: boolean | null = null;
  if (email) {
    const [, domain] = email.split("@");
    emailValid = domain ? await hasMxRecord(domain) : false;
  }

  // The website's own "Owner:"/"Founder:" text or structured data is a more
  // reliable name than an email-address guess when it's present at all —
  // only fall back to guessing from the email local part if it isn't.
  let ownerName = guessOwnerNameFromHtml(html);
  if (!ownerName && email) {
    const [localPart] = email.split("@");
    ownerName = guessOwnerName(localPart ?? "");
  }

  const result: LeadEnrichmentResult = {
    email,
    emailValid,
    ownerName,
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
    twitterUrl: null,
  };
  for (const { key, regex } of SOCIAL_PATTERNS) {
    const match = html.match(regex);
    if (match) result[key] = trimTrailingPunctuation(match[0]);
  }

  return result;
}
