import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/unread — total unread message count for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ count: 0 });

  const memberships = await prisma.chatMember.findMany({
    where: { userId: session.user.id },
    select: {
      lastReadAt: true,
      room: {
        select: {
          messages: {
            select: { createdAt: true, senderId: true },
          },
        },
      },
    },
  });

  let total = 0;
  for (const m of memberships) {
    const unread = m.room.messages.filter(
      (msg) =>
        msg.senderId !== session.user.id &&
        (!m.lastReadAt || msg.createdAt > m.lastReadAt)
    ).length;
    total += unread;
  }

  return NextResponse.json({ count: total });
}
