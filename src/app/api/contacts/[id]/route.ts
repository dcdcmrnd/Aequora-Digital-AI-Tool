import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  additionalEmails: z.array(z.string()).optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  facebookUrl: z.string().nullable().optional(),
  instagramUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  twitterUrl: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assignedToId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: { createdBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    contact: { ...contact, tags: JSON.parse(contact.tags), additionalEmails: JSON.parse(contact.additionalEmails) },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const data: Prisma.ContactUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) data.lastName = parsed.data.lastName;
  if (parsed.data.company !== undefined) data.company = parsed.data.company;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.additionalEmails !== undefined) data.additionalEmails = JSON.stringify(parsed.data.additionalEmails);
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (parsed.data.website !== undefined) data.website = parsed.data.website;
  if (parsed.data.facebookUrl !== undefined) data.facebookUrl = parsed.data.facebookUrl;
  if (parsed.data.instagramUrl !== undefined) data.instagramUrl = parsed.data.instagramUrl;
  if (parsed.data.linkedinUrl !== undefined) data.linkedinUrl = parsed.data.linkedinUrl;
  if (parsed.data.twitterUrl !== undefined) data.twitterUrl = parsed.data.twitterUrl;
  if (parsed.data.address !== undefined) data.address = parsed.data.address;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.tags !== undefined) data.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.assignedToId !== undefined) data.assignedTo = parsed.data.assignedToId ? { connect: { id: parsed.data.assignedToId } } : { disconnect: true };

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data,
    include: { createdBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
  });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "contact",
    entityId: updated.id,
    entityName: updated.name,
  });

  if (parsed.data.tags !== undefined) {
    const previousTags = new Set(JSON.parse(existing.tags) as string[]);
    const newTags = parsed.data.tags.filter((tag) => !previousTags.has(tag));
    for (const tag of newTags) {
      await runAutomationsForTrigger({ triggerType: "tag_added", contactId: updated.id, tag });
    }
  }

  return NextResponse.json({
    contact: { ...updated, tags: JSON.parse(updated.tags), additionalEmails: JSON.parse(updated.additionalEmails) },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contact.delete({ where: { id: params.id } });

  await logActivity({
    userId: session.user.id,
    action: "deleted",
    entityType: "contact",
    entityId: existing.id,
    entityName: existing.name,
  });

  return NextResponse.json({ success: true });
}
