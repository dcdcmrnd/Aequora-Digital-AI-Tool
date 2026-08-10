import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EMPTY_FLOW } from "@/lib/automation/types";

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "trigger", "send_email", "add_tag", "remove_tag", "move_pipeline_stage", "condition", "wait",
    "create_task", "create_note", "create_opportunity", "update_contact_field", "update_opportunity",
    "assign_contact_to_user", "send_notification", "webhook", "enroll_in_automation", "set_event_date", "end_workflow",
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
});

const flowSchema = z.object({ nodes: z.array(nodeSchema), edges: z.array(edgeSchema) });

const automationSchema = z.object({
  name: z.string().min(1, "Name is required."),
  isActive: z.boolean().default(true),
  allowMultipleEntries: z.boolean().default(true),
  allowReentry: z.boolean().default(true),
  flow: flowSchema.default(EMPTY_FLOW),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const automations = await prisma.automation.findMany({
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.automationRun.groupBy({ by: ["automationId", "status"], _count: true });
  const statsByAutomation = new Map<string, { total: number; active: number }>();
  for (const c of counts) {
    const entry = statsByAutomation.get(c.automationId) ?? { total: 0, active: 0 };
    entry.total += c._count;
    if (c.status === "running" || c.status === "waiting") entry.active += c._count;
    statsByAutomation.set(c.automationId, entry);
  }

  return NextResponse.json({
    automations: automations.map((a) => ({
      ...a,
      flow: JSON.parse(a.flow),
      contactsEntered: statsByAutomation.get(a.id)?.total ?? 0,
      activeContacts: statsByAutomation.get(a.id)?.active ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = automationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid automation." }, { status: 400 });
  }

  const automation = await prisma.automation.create({
    data: {
      name: parsed.data.name,
      isActive: parsed.data.isActive,
      allowMultipleEntries: parsed.data.allowMultipleEntries,
      allowReentry: parsed.data.allowReentry,
      flow: JSON.stringify(parsed.data.flow),
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ automation: { ...automation, flow: JSON.parse(automation.flow) } }, { status: 201 });
}
