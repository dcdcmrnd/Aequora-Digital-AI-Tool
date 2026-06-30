import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sig = await prisma.emailSignature.findUnique({ where: { id: params.id } });
  if (!sig) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sig.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, content, isDefault } = await req.json();

  if (isDefault) {
    await prisma.emailSignature.updateMany({
      where: { userId: sig.userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.emailSignature.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(content !== undefined && { content: content.trim() }),
      ...(isDefault !== undefined && { isDefault }),
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ signature: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sig = await prisma.emailSignature.findUnique({ where: { id: params.id } });
  if (!sig) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sig.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.emailSignature.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
