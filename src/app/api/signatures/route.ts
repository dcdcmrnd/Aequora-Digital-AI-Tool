import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const signatures = await prisma.emailSignature.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ signatures });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, content, isDefault } = await req.json();
  if (!name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Name and content are required." }, { status: 400 });
  }

  if (isDefault) {
    await prisma.emailSignature.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const signature = await prisma.emailSignature.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      content: content.trim(),
      isDefault: isDefault ?? false,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ signature }, { status: 201 });
}
