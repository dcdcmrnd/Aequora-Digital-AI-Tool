import crypto from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** Rotates an automation's inbound-webhook secret, invalidating its previous URL. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const automation = await prisma.automation.update({
    where: { id: params.id },
    data: { webhookSecret: crypto.randomBytes(24).toString("hex") },
  });

  return NextResponse.json({ webhookSecret: automation.webhookSecret });
}
