import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { enrichFromWebsite } from "@/lib/leadEnrichment";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getLeadById } from "@/services/business";

/** Fetches a lead's website and scans it for a contact email and social profile links — Google Places doesn't expose either. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  const canManage = isAdmin || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lead = await getLeadById(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.website) return NextResponse.json({ error: "This lead has no website to check." }, { status: 400 });

  let result;
  try {
    result = await enrichFromWebsite(lead.website);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read this website." },
      { status: 502 },
    );
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      enrichedEmail: result.email,
      enrichedEmailValid: result.emailValid,
      enrichedOwnerName: result.ownerName,
      enrichedFacebookUrl: result.facebookUrl,
      enrichedInstagramUrl: result.instagramUrl,
      enrichedLinkedinUrl: result.linkedinUrl,
      enrichedTwitterUrl: result.twitterUrl,
      enrichedAt: new Date(),
    },
    include: { audit: true },
  });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "lead",
    entityId: updated.id,
    entityName: updated.name,
    metadata: { action: "enrich" },
  });

  return NextResponse.json({ lead: updated });
}
