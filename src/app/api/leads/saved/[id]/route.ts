import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LEAD_STATUS_VALUES = ["New", "Contacted", "Meeting Scheduled", "Proposal Sent", "Won", "Lost"] as const;

const updateSchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  followUpDate: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const savedLead = await prisma.savedLead.findUnique({ where: { id: params.id } });
  if (!savedLead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && savedLead.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const data: Prisma.SavedLeadUpdateInput = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.tags !== undefined) data.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.followUpDate !== undefined) {
    data.followUpDate = parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null;
  }

  const updated = await prisma.savedLead.update({
    where: { id: params.id },
    data,
    include: { lead: { include: { audit: true } } },
  });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "lead",
    entityId: updated.leadId,
    entityName: updated.lead.name,
    metadata: { action: "status_update", status: updated.status },
  });

  return NextResponse.json({ savedLead: { ...updated, tags: JSON.parse(updated.tags) } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const savedLead = await prisma.savedLead.findUnique({
    where: { id: params.id },
    include: { lead: true },
  });
  if (!savedLead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && savedLead.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.savedLead.delete({ where: { id: params.id } });

  await logActivity({
    userId: session.user.id,
    action: "deleted",
    entityType: "lead",
    entityId: savedLead.leadId,
    entityName: savedLead.lead.name,
    metadata: { action: "unsaved" },
  });

  return NextResponse.json({ success: true });
}
