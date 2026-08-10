import { promises as dns } from "dns";
import net from "net";

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
  /** Best-effort "John Smith" guess, only when the local part looks personal rather than generic. */
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

/** "john.smith" / "john_smith" -> "John Smith". Anything generic, or without a clean two-part name split, returns null rather than a bad guess. */
function guessOwnerName(localPart: string): string | null {
  if (isGenericLocalPart(localPart)) return null;
  const parts = localPart.split(/[._-]/).filter(Boolean);
  if (parts.length !== 2 || !parts.every((p) => /^[a-z]{2,}$/i.test(p))) return null;
  return parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}

const MX_LOOKUP_TIMEOUT_MS = 4_000;

/** Best-effort "can this domain receive mail at all" check — false on any lookup failure (no MX, NXDOMAIN, timeout). Not full deliverability verification, just a sanity check that rules out obviously dead domains. */
async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MX lookup timed out")), MX_LOOKUP_TIMEOUT_MS)),
    ]);
    return records.length > 0;
  } catch {
    return false;
  }
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
  let ownerName: string | null = null;
  if (email) {
    const [localPart, domain] = email.split("@");
    emailValid = domain ? await hasMxRecord(domain) : false;
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
