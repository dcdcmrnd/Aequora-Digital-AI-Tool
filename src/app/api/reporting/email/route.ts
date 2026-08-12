import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function rate(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

/** Aggregates outreach stats across EmailTracking — every send (manual or automation) gets a row there. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam && daysParam !== "all" ? Number(daysParam) : null;
  const where = days ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } : {};

  const [total, bounced, opened, replied] = await Promise.all([
    prisma.emailTracking.count({ where }),
    prisma.emailTracking.count({ where: { ...where, bounced: true } }),
    prisma.emailTracking.count({ where: { ...where, openedAt: { not: null } } }),
    prisma.emailTracking.count({ where: { ...where, repliedAt: { not: null } } }),
  ]);
  const delivered = total - bounced;

  return NextResponse.json({
    sent: total,
    delivered,
    bounced,
    opened,
    replied,
    bounceRate: rate(bounced, total),
    deliveredRate: rate(delivered, total),
    openRate: rate(opened, total),
    replyRate: rate(replied, total),
  });
}
