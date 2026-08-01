import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  actionType: z.enum(["send_email", "add_tag", "move_pipeline_stage"]),
  config: z.record(z.string()),
});

const automationSchema = z.object({
  name: z.string().min(1, "Name is required."),
  triggerType: z.enum(["contact_created", "tag_added", "opportunity_stage_changed"]),
  triggerConfig: z.record(z.string()).default({}),
  isActive: z.boolean().default(true),
  actions: z.array(actionSchema).min(1, "Add at least one action."),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const automations = await prisma.automation.findMany({
    include: {
      actions: { orderBy: { order: "asc" } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    automations: automations.map((a) => ({
      ...a,
      triggerConfig: JSON.parse(a.triggerConfig),
      actions: a.actions.map((action) => ({ ...action, config: JSON.parse(action.config) })),
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
      triggerType: parsed.data.triggerType,
      triggerConfig: JSON.stringify(parsed.data.triggerConfig),
      isActive: parsed.data.isActive,
      createdById: session.user.id,
      actions: {
        create: parsed.data.actions.map((action, order) => ({
          order,
          actionType: action.actionType,
          config: JSON.stringify(action.config),
        })),
      },
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(
    {
      automation: {
        ...automation,
        triggerConfig: JSON.parse(automation.triggerConfig),
        actions: automation.actions.map((action) => ({ ...action, config: JSON.parse(action.config) })),
      },
    },
    { status: 201 },
  );
}
