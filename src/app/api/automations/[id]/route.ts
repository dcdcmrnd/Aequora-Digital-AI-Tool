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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  triggerType: z.enum(["contact_created", "tag_added", "opportunity_stage_changed"]).optional(),
  triggerConfig: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
  actions: z.array(actionSchema).optional(),
});

function serialize(automation: {
  triggerConfig: string;
  actions: { config: string; [k: string]: unknown }[];
  [k: string]: unknown;
}) {
  return {
    ...automation,
    triggerConfig: JSON.parse(automation.triggerConfig),
    actions: automation.actions.map((action) => ({ ...action, config: JSON.parse(action.config) })),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const automation = await prisma.automation.findUnique({
    where: { id: params.id },
    include: {
      actions: { orderBy: { order: "asc" } },
      runs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ automation: serialize(automation) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  // Actions are replaced wholesale rather than diffed — simplest correct
  // option given the builder always submits the full ordered list.
  if (parsed.data.actions !== undefined) {
    await prisma.automationAction.deleteMany({ where: { automationId: params.id } });
  }

  const automation = await prisma.automation.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.triggerType !== undefined && { triggerType: parsed.data.triggerType }),
      ...(parsed.data.triggerConfig !== undefined && { triggerConfig: JSON.stringify(parsed.data.triggerConfig) }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.actions !== undefined && {
        actions: {
          create: parsed.data.actions.map((action, order) => ({
            order,
            actionType: action.actionType,
            config: JSON.stringify(action.config),
          })),
        },
      }),
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ automation: serialize(automation) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.automation.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
