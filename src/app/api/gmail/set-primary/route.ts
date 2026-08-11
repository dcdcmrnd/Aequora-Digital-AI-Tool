import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email() });

/** Sets which agency-scoped connected account opens by default in Conversations — unsets it on every other agency account. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const token = await prisma.gmailToken.findUnique({ where: { email: parsed.data.email } });
  if (!token || token.ownerId !== null) {
    return NextResponse.json({ error: "That's not a connected agency email." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.gmailToken.updateMany({ where: { ownerId: null, isPrimary: true }, data: { isPrimary: false } }),
    prisma.gmailToken.update({ where: { email: parsed.data.email }, data: { isPrimary: true } }),
  ]);

  return NextResponse.json({ success: true });
}
