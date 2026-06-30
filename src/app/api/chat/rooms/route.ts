import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MEMBER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
};

// GET /api/chat/rooms — list all rooms the current user belongs to
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.chatMember.findMany({
    where: { userId: session.user.id },
    include: {
      room: {
        include: {
          members: { include: { user: { select: MEMBER_SELECT } } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: MEMBER_SELECT } },
          },
        },
      },
    },
    orderBy: { room: { updatedAt: "desc" } },
  });

  const rooms = memberships.map((m) => {
    const unread = m.lastReadAt
      ? m.room.messages.filter((msg) => msg.createdAt > m.lastReadAt!).length
      : m.room.messages.length;

    return {
      id: m.room.id,
      name: m.room.name,
      isGroup: m.room.isGroup,
      createdById: m.room.createdById,
      members: m.room.members.map((cm) => cm.user),
      lastMessage: m.room.messages[0]
        ? {
            content: m.room.messages[0].content,
            senderName: m.room.messages[0].sender.name,
            createdAt: m.room.messages[0].createdAt.toISOString(),
          }
        : null,
      unreadCount: unread,
    };
  });

  return NextResponse.json({ rooms });
}

// POST /api/chat/rooms — create a DM or group chat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberIds, name, isGroup } = await req.json();
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "memberIds required" }, { status: 400 });
  }

  // For DMs: check if a direct room already exists between these two users
  if (!isGroup && memberIds.length === 1) {
    const otherId = memberIds[0];
    const existing = await prisma.chatRoom.findFirst({
      where: {
        isGroup: false,
        members: { every: { userId: { in: [session.user.id, otherId] } } },
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId: otherId } } },
        ],
      },
      include: {
        members: { include: { user: { select: MEMBER_SELECT } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: MEMBER_SELECT } },
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        room: {
          id: existing.id,
          name: existing.name,
          isGroup: false,
          createdById: existing.createdById,
          members: existing.members.map((m) => m.user),
          lastMessage: null,
          unreadCount: 0,
        },
      });
    }
  }

  const allMemberIds = Array.from(new Set([session.user.id, ...memberIds]));

  const room = await prisma.chatRoom.create({
    data: {
      name: isGroup ? (name?.trim() || null) : null,
      isGroup: Boolean(isGroup),
      createdById: session.user.id,
      members: {
        create: allMemberIds.map((uid) => ({ userId: uid })),
      },
    },
    include: {
      members: { include: { user: { select: MEMBER_SELECT } } },
    },
  });

  return NextResponse.json({
    room: {
      id: room.id,
      name: room.name,
      isGroup: room.isGroup,
      createdById: room.createdById,
      members: room.members.map((m) => m.user),
      lastMessage: null,
      unreadCount: 0,
    },
  });
}
