import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

/** A short, human-readable preview for a notification body — content may be plain text or a JSON-encoded audio/image payload. */
function previewChatContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{"type":"audio"')) return "🎤 Voice message";
  if (trimmed.startsWith('{"type":"image"') || trimmed.startsWith('{"type":"gif"')) return "📷 Photo";
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

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

  const otherMembers = await prisma.chatMember.findMany({
    where: { roomId: params.id, userId: { not: session.user.id } },
    select: { userId: true },
  });
  const preview = previewChatContent(content.trim());
  await Promise.all(
    otherMembers.map((m) =>
      createNotification({
        userId: m.userId,
        type: "chat_message",
        title: `New message from ${message.sender.name}`,
        body: preview,
        entityType: "chat",
        entityId: params.id,
      }),
    ),
  );

  return NextResponse.json({
    message: { ...message, createdAt: message.createdAt.toISOString() },
  });
}
