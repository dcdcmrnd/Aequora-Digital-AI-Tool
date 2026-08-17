import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { DEFAULT_ICP_TITLES } from "@/lib/leads/constants";
import { findPeopleFromWebsite } from "@/lib/leads/personFinder";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { upsertFoundPeople } from "@/services/people";

const FIND_PEOPLE_CONCURRENCY = 3; // Lower than bulk-verify's 10 -- each lead here does multiple page fetches, not one MX lookup.
// Vercel's Hobby plan caps a function at 60s regardless of maxDuration (see
// bulk-verify's own maxDuration=60) -- a lead can take ~8-24s worst case
// (homepage + a few subpages), so at concurrency 3 this cap keeps a full
// batch inside that budget instead of getting silently killed mid-run.
const BULK_FIND_PEOPLE_CAP = 20;

export const maxDuration = 60;

const schema = z.object({ leadIds: z.array(z.string()).min(1).max(BULK_FIND_PEOPLE_CAP) });

/** Bulk version of the single-lead "Find People" action — crawls each selected lead's website, skipping any without one. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const leads = await prisma.lead.findMany({
    where: { id: { in: parsed.data.leadIds }, website: { not: null } },
    select: { id: true, website: true, phone: true },
  });

  let peopleFound = 0;
  let failed = 0;

  await mapWithConcurrency(leads, FIND_PEOPLE_CONCURRENCY, async (lead) => {
    let found;
    try {
      found = await findPeopleFromWebsite(lead.website!, DEFAULT_ICP_TITLES);
    } catch {
      failed += 1;
      return;
    }

    await upsertFoundPeople(lead.id, found, undefined, lead.phone);
    peopleFound += found.length;
  });

  return NextResponse.json({ processed: leads.length, peopleFound, failed });
}
