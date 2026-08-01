import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const DEFAULT_STAGES = ["New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let pipeline = await prisma.pipeline.findFirst({
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        name: "Sales Pipeline",
        stages: { create: DEFAULT_STAGES.map((name, order) => ({ name, order })) },
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });
  }

  return NextResponse.json({ pipeline });
}
