import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/chat/rooms/[id]/messages/[messageId] — edit a message you sent
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const message = await prisma.chatMessage.findUnique({ where: { id: params.messageId } });
  if (!message || message.roomId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.senderId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const updated = await prisma.chatMessage.update({
    where: { id: params.messageId },
    data: { content: content.trim(), editedAt: new Date() },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return NextResponse.json({
    message: { ...updated, createdAt: updated.createdAt.toISOString(), editedAt: updated.editedAt?.toISOString() ?? null },
  });
}

// DELETE /api/chat/rooms/[id]/messages/[messageId] — delete a message you sent
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const message = await prisma.chatMessage.findUnique({ where: { id: params.messageId } });
  if (!message || message.roomId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.senderId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.chatMessage.delete({ where: { id: params.messageId } });

  return NextResponse.json({ success: true });
}
