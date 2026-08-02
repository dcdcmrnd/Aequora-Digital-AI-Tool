import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["trigger", "send_email", "add_tag", "move_pipeline_stage", "condition", "wait"]),
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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  flow: flowSchema.optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const automation = await prisma.automation.findUnique({
    where: { id: params.id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ automation: { ...automation, flow: JSON.parse(automation.flow) } });
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

  const automation = await prisma.automation.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.flow !== undefined && { flow: JSON.stringify(parsed.data.flow) }),
    },
  });

  return NextResponse.json({ automation: { ...automation, flow: JSON.parse(automation.flow) } });
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
