import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { DEFAULT_ICP_TITLES } from "@/lib/leads/constants";
import { findPeopleFromWebsite } from "@/lib/leads/personFinder";
import { checkPermission } from "@/lib/permissions";
import { getLeadById } from "@/services/business";
import { upsertFoundPeople } from "@/services/people";

export const maxDuration = 60;

/** Crawls a lead's website (homepage + About/Team/Contact-style subpages) for named decision-makers and upserts them as LeadPerson rows. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lead = await getLeadById(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.website) return NextResponse.json({ error: "This lead has no website to check." }, { status: 400 });

  let found;
  try {
    found = await findPeopleFromWebsite(lead.website, DEFAULT_ICP_TITLES);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read this website." },
      { status: 502 },
    );
  }

  const people = await upsertFoundPeople(lead.id, found, undefined, lead.phone);

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "lead",
    entityId: lead.id,
    entityName: lead.name,
    metadata: { action: "find-people", found: found.length },
  });

  return NextResponse.json({ people });
}
