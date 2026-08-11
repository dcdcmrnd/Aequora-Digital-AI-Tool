import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { hasMxRecord, isValidEmailSyntax } from "@/lib/emailVerification";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const VERIFY_CONCURRENCY = 10;

export const maxDuration = 60;

const schema = z.object({ leadIds: z.array(z.string()).min(1).max(500) });

/**
 * Re-checks the MX record for each lead's already-enriched email — lighter
 * than a full re-enrichment (no website re-scrape), just refreshes
 * enrichedEmailValid/enrichedAt for leads whose email might have gone stale
 * or was never checked.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const leads = await prisma.lead.findMany({
    where: { id: { in: parsed.data.leadIds }, enrichedEmail: { not: null } },
    select: { id: true, enrichedEmail: true },
  });

  const results = await mapWithConcurrency(leads, VERIFY_CONCURRENCY, async (lead) => {
    const email = lead.enrichedEmail!;
    const valid = isValidEmailSyntax(email) && (await hasMxRecord(email.split("@")[1]));
    await prisma.lead.update({ where: { id: lead.id }, data: { enrichedEmailValid: valid, enrichedAt: new Date() } });
    return valid;
  });

  return NextResponse.json({
    checked: leads.length,
    valid: results.filter(Boolean).length,
    invalid: results.filter((v) => !v).length,
  });
}
