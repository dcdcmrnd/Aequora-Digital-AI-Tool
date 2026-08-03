import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const opportunitySchema = z.object({
  name: z.string().min(1, "Name is required."),
  value: z.number().nonnegative().optional(),
  contactId: z.string().min(1, "A contact is required."),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const opportunities = await prisma.opportunity.findMany({
    include: { contact: { select: { id: true, name: true, company: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ opportunities });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = opportunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid opportunity." }, { status: 400 });
  }

  const opportunity = await prisma.opportunity.create({
    data: { ...parsed.data, createdById: session.user.id },
    include: { contact: { select: { id: true, name: true, company: true } } },
  });

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "opportunity",
    entityId: opportunity.id,
    entityName: opportunity.name,
  });

  await runAutomationsForTrigger({ triggerType: "opportunity_created", contactId: opportunity.contactId });

  return NextResponse.json({ opportunity }, { status: 201 });
}
