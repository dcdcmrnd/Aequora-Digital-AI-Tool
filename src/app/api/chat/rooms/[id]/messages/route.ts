import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/rooms/[id]/messages
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // cursor for pagination
  const limit = 50;

  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId: params.id,
      ...(before && { createdAt: { lt: new Date(before) } }),
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Update lastReadAt for this member
  await prisma.chatMember.update({
    where: { roomId_userId: { roomId: params.id, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    messages: messages.reverse().map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    hasMore: messages.length === limit,
  });
}

// POST /api/chat/rooms/[id]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId: params.id, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        roomId: params.id,
        senderId: session.user.id,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    // bump room updatedAt so rooms list re-sorts
    prisma.chatRoom.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    }),
    // mark sender as read
    prisma.chatMember.update({
      where: { roomId_userId: { roomId: params.id, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    message: { ...message, createdAt: message.createdAt.toISOString() },
  });
}
