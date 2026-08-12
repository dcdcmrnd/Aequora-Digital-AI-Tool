import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** People found so far for one lead — backs the "People at this business" card on the lead detail page. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const people = await prisma.leadPerson.findMany({ where: { leadId: params.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ people });
}
