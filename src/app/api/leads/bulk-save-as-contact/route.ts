import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { leadContactNamePrefill } from "@/lib/leads/constants";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadIds: z.array(z.string()).min(1).max(500) });

/**
 * Bulk version of the single "Save as Contact" action already on each lead —
 * same field mapping (business name always to Company, owner name split to
 * First/Last when known), applied to a batch. Leads with an email that
 * already matches an existing contact are skipped rather than erroring the
 * whole batch, same as the single-save 409 but non-fatal here.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const leads = await prisma.lead.findMany({ where: { id: { in: parsed.data.leadIds } } });

  let created = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (lead.enrichedEmail) {
      const existing = await prisma.contact.findFirst({
        where: { email: { equals: lead.enrichedEmail, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    const { firstName, lastName } = leadContactNamePrefill(lead.name, lead.enrichedOwnerName);

    const contact = await prisma.contact.create({
      data: {
        name: [firstName, lastName].filter(Boolean).join(" "),
        firstName,
        lastName,
        company: lead.name,
        email: lead.enrichedEmail ?? undefined,
        phone: lead.phone ?? undefined,
        website: lead.website ?? undefined,
        address: lead.address ?? undefined,
        facebookUrl: lead.enrichedFacebookUrl ?? undefined,
        instagramUrl: lead.enrichedInstagramUrl ?? undefined,
        linkedinUrl: lead.enrichedLinkedinUrl ?? undefined,
        twitterUrl: lead.enrichedTwitterUrl ?? undefined,
        sourceLeadId: lead.id,
        tags: JSON.stringify([]),
        additionalEmails: JSON.stringify([]),
        createdById: session.user.id,
      },
    });
    created += 1;

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "contact",
      entityId: contact.id,
      entityName: contact.name,
    });
    // Every contact-creation path should enroll new contacts the same way,
    // whether it's one at a time (POST /api/contacts) or a batch like this —
    // this was previously skipped here, so bulk-saved leads silently never
    // started their "new contact" automations.
    await runAutomationsForTrigger({ triggerType: "contact_created", contactId: contact.id });
  }

  return NextResponse.json({ created, skipped });
}
