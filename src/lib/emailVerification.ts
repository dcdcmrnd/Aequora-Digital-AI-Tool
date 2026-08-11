import { promises as dns } from "dns";

import { prisma } from "@/lib/prisma";

export type EmailVerificationStatus = "valid" | "invalid" | "unknown";

// How long a cached result is trusted before a bulk-verify re-checks it —
// MX records for a real business domain essentially never change day to
// day, so this just bounds staleness without re-querying DNS constantly.
const VERIFICATION_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const MX_LOOKUP_TIMEOUT_MS = 4_000;

const EMAIL_SYNTAX_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailSyntax(email: string): boolean {
  return EMAIL_SYNTAX_PATTERN.test(email.trim());
}

/**
 * Best-effort "can this domain receive mail at all" check — false on any
 * lookup failure (no MX, NXDOMAIN, timeout). Not full deliverability
 * verification (no paid API behind this): it can't tell you a specific
 * mailbox exists, only that the domain has a mail server at all.
 */
export async function hasMxRecord(domain: string): Promise<boolean> {
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

/**
 * Free syntax + MX-record check — no paid verification API. "valid" means
 * well-formed with a domain that can receive mail, not that the specific
 * mailbox exists; it won't catch a full mailbox, a disposable address, or a
 * catch-all domain silently accepting everything.
 */
export async function verifyEmail(email: string): Promise<EmailVerificationStatus> {
  const trimmed = email.trim();
  if (!isValidEmailSyntax(trimmed)) return "invalid";

  const domain = trimmed.split("@")[1];
  if (!domain) return "invalid";

  return (await hasMxRecord(domain)) ? "valid" : "invalid";
}

function isStale(checkedAt: Date | null): boolean {
  return !checkedAt || Date.now() - checkedAt.getTime() > VERIFICATION_STALE_AFTER_MS;
}

/**
 * Verifies an email and writes the result to every Contact row with a
 * matching address (case-insensitive) — reuses a cached result less than 30
 * days old instead of re-running DNS lookups on every call, since this runs
 * synchronously on the send path.
 */
export async function verifyAndCacheForContacts(email: string): Promise<EmailVerificationStatus> {
  const trimmed = email.trim();
  const existing = await prisma.contact.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" } },
    select: { emailVerificationStatus: true, emailVerifiedAt: true },
  });

  if (existing?.emailVerificationStatus && !isStale(existing.emailVerifiedAt)) {
    return existing.emailVerificationStatus as EmailVerificationStatus;
  }

  const status = await verifyEmail(trimmed);
  await prisma.contact.updateMany({
    where: { email: { equals: trimmed, mode: "insensitive" } },
    data: { emailVerificationStatus: status, emailVerifiedAt: new Date() },
  });
  return status;
}
