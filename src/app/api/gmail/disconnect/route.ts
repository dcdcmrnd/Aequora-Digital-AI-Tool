import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const token = await prisma.gmailToken.findUnique({ where: { email }, select: { ownerId: true } });
  if (!token) return NextResponse.json({ success: true });

  const isAdmin = session.user.role === "admin";
  const authorized = token.ownerId === null ? isAdmin : token.ownerId === session.user.id;
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.gmailToken.deleteMany({ where: { email } });
  return NextResponse.json({ success: true });
}
