import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const stageSchema = z.object({
  pipelineId: z.string().min(1),
  name: z.string().min(1, "Stage name is required."),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid stage." }, { status: 400 });
  }

  const maxOrder = await prisma.pipelineStage.aggregate({
    where: { pipelineId: parsed.data.pipelineId },
    _max: { order: true },
  });

  const stage = await prisma.pipelineStage.create({
    data: {
      pipelineId: parsed.data.pipelineId,
      name: parsed.data.name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ stage }, { status: 201 });
}
