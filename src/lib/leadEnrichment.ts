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
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
}

const SOCIAL_PATTERNS: { key: keyof Omit<LeadEnrichmentResult, "email">; regex: RegExp }[] = [
  { key: "facebookUrl", regex: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/i },
  { key: "instagramUrl", regex: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/i },
  { key: "linkedinUrl", regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>)]+/i },
  { key: "twitterUrl", regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>)]+/i },
];

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

/** Fetches a lead's website and scans it for a contact email and social profile links. */
export async function enrichFromWebsite(websiteUrl: string): Promise<LeadEnrichmentResult> {
  const url = await assertPublicHttpUrl(websiteUrl);
  const html = await fetchHtml(url);

  const emailMatch = html.match(/mailto:([^"'?\s]+)/i);
  const email = emailMatch ? decodeURIComponent(emailMatch[1]) : null;

  const result: LeadEnrichmentResult = { email, facebookUrl: null, instagramUrl: null, linkedinUrl: null, twitterUrl: null };
  for (const { key, regex } of SOCIAL_PATTERNS) {
    const match = html.match(regex);
    if (match) result[key] = trimTrailingPunctuation(match[0]);
  }

  return result;
}
