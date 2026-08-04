import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** How many contacts are currently sitting at each step of this workflow — powers the live badge on each node in the builder. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const grouped = await prisma.automationRun.groupBy({
    by: ["currentNodeId"],
    where: { automationId: params.id, status: { in: ["running", "waiting", "error"] }, currentNodeId: { not: null } },
    _count: true,
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) {
    if (row.currentNodeId) counts[row.currentNodeId] = row._count;
  }

  return NextResponse.json({ counts });
}
