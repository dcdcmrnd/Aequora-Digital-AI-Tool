import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { escapeLikePattern } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({ personIds: z.array(z.string()).min(1).max(500) });

/** Same shape as leads' bulk-save-as-contact, sourced from LeadPerson instead: name split to First/Last, title carried over, company/website/sourceLeadId taken from the parent Lead. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const people = await prisma.leadPerson.findMany({
    where: { id: { in: parsed.data.personIds } },
    include: { lead: true },
  });

  let created = 0;
  let skipped = 0;

  for (const person of people) {
    if (person.email) {
      const existing = await prisma.contact.findFirst({
        where: { email: { equals: escapeLikePattern(person.email), mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    const nameParts = (person.name ?? person.lead.name).trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? person.lead.name;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    const contact = await prisma.contact.create({
      data: {
        name: [firstName, lastName].filter(Boolean).join(" "),
        firstName,
        lastName,
        title: person.title ?? undefined,
        company: person.lead.name,
        email: person.email ?? undefined,
        phone: person.phone ?? undefined,
        website: person.lead.website ?? undefined,
        address: person.lead.address ?? undefined,
        sourceLeadId: person.leadId,
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
    await runAutomationsForTrigger({ triggerType: "contact_created", contactId: contact.id });
  }

  return NextResponse.json({ created, skipped });
}
