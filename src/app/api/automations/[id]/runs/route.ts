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

  const runs = await prisma.automationRun.findMany({
    where: { automationId: params.id },
    include: {
      contact: { select: { id: true, name: true, email: true, company: true } },
      steps: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ runs });
}
