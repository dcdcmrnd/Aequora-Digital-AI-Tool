import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, status: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, avatarUrl, currentPassword, newPassword } = body;

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });
    if (!user?.password) {
      return NextResponse.json({ error: "Cannot change password." }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: await bcrypt.hash(newPassword, 12) },
    });
  }

  // Profile fields
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
    },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
  });

  return NextResponse.json({ user: updated });
}
