import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { verifyAndCacheForContacts } from "@/lib/emailVerification";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const VERIFY_CONCURRENCY = 10;

// MX lookups can each take a few seconds worst-case; give a real list room
// to finish within one request instead of timing out partway through.
export const maxDuration = 60;

/**
 * Bulk-verifies every contact with an email on file — reuses the same
 * cache-aware check as the send path, so this is cheap to re-run (already
 * fresh, unchanged emails are skipped) and only actually does DNS work for
 * contacts that are new or past the 30-day staleness window.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contacts = await prisma.contact.findMany({
    where: { email: { not: null } },
    select: { email: true },
  });

  const results = await mapWithConcurrency(contacts, VERIFY_CONCURRENCY, (c) => verifyAndCacheForContacts(c.email!));

  return NextResponse.json({
    checked: contacts.length,
    valid: results.filter((r) => r === "valid").length,
    invalid: results.filter((r) => r === "invalid").length,
  });
}
