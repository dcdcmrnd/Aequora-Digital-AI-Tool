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
  value: z.number().nonnegative().nullable().optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  stageId: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: { contact: { select: { id: true, name: true, company: true } } },
  });
  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ opportunity });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const data: Prisma.OpportunityUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.value !== undefined) data.value = parsed.data.value;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.stageId !== undefined) data.stage = { connect: { id: parsed.data.stageId } };
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const updated = await prisma.opportunity.update({
    where: { id: params.id },
    data,
    include: { contact: { select: { id: true, name: true, company: true } } },
  });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "opportunity",
    entityId: updated.id,
    entityName: updated.name,
  });

  if (parsed.data.stageId !== undefined && parsed.data.stageId !== existing.stageId) {
    await runAutomationsForTrigger({
      triggerType: "opportunity_stage_changed",
      contactId: updated.contactId,
      stageId: parsed.data.stageId,
    });
  }

  if (parsed.data.status !== undefined && parsed.data.status !== existing.status && (parsed.data.status === "won" || parsed.data.status === "lost")) {
    await runAutomationsForTrigger({
      triggerType: parsed.data.status === "won" ? "opportunity_won" : "opportunity_lost",
      contactId: updated.contactId,
    });
  }

  return NextResponse.json({ opportunity: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.opportunity.delete({ where: { id: params.id } });

  await logActivity({
    userId: session.user.id,
    action: "deleted",
    entityType: "opportunity",
    entityId: existing.id,
    entityName: existing.name,
  });

  return NextResponse.json({ success: true });
}
