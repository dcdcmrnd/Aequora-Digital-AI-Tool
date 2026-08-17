import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { escapeLikePattern } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { flattenContactCustomFields, upsertContactCustomFieldValues } from "@/services/customFields";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required."),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  additionalEmails: z.array(z.string()).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  facebookUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceLeadId: z.string().optional(),
  customFields: z.record(z.string()).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contacts = await prisma.contact.findMany({
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      customFieldValues: { include: { field: { select: { key: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    contacts: contacts.map(({ customFieldValues, ...contact }) => ({
      ...contact,
      tags: JSON.parse(contact.tags),
      additionalEmails: JSON.parse(contact.additionalEmails),
      customFields: flattenContactCustomFields(customFieldValues),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid contact." }, { status: 400 });
  }

  const { additionalEmails, customFields, ...rest } = parsed.data;

  if (rest.email) {
    const existing = await prisma.contact.findFirst({
      where: { email: { equals: escapeLikePattern(rest.email), mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json({ error: `A contact with this email already exists: ${existing.name}` }, { status: 409 });
    }
  }

  const contact = await prisma.contact.create({
    data: {
      ...rest,
      tags: JSON.stringify(parsed.data.tags ?? []),
      additionalEmails: JSON.stringify(additionalEmails ?? []),
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  if (customFields) await upsertContactCustomFieldValues(contact.id, customFields);

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "contact",
    entityId: contact.id,
    entityName: contact.name,
  });

  await runAutomationsForTrigger({ triggerType: "contact_created", contactId: contact.id });
  for (const tag of parsed.data.tags ?? []) {
    await runAutomationsForTrigger({ triggerType: "tag_added", contactId: contact.id, tag });
  }

  return NextResponse.json(
    {
      contact: {
        ...contact,
        tags: JSON.parse(contact.tags),
        additionalEmails: JSON.parse(contact.additionalEmails),
        customFields: customFields ?? {},
      },
    },
    { status: 201 },
  );
}
