import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const automation = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // When scoped to a single node (the builder's "contacts at this step" panel),
  // only the still-actionable runs matter, and the full step history isn't needed.
  const nodeId = req.nextUrl.searchParams.get("nodeId");

  const runs = await prisma.automationRun.findMany({
    where: {
      automationId: params.id,
      ...(nodeId ? { currentNodeId: nodeId, status: { in: ["running", "waiting", "error"] } } : {}),
    },
    include: {
      contact: { select: { id: true, name: true, email: true, company: true } },
      ...(nodeId ? {} : { steps: { orderBy: { createdAt: "asc" } } }),
    },
    orderBy: { createdAt: "desc" },
    take: nodeId ? 200 : 50,
  });

  return NextResponse.json({ runs });
}
