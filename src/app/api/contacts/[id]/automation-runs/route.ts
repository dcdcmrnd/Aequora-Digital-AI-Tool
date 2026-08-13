import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** A contact's automation history — which workflows they're in/have been through, for the Conversations contact-detail column. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runs = await prisma.automationRun.findMany({
    where: { contactId: params.id },
    include: { automation: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      automationId: r.automation.id,
      automationName: r.automation.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}
