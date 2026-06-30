import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import type { ChatRoom } from "@/components/chat/ChatPageClient";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let rooms: ChatRoom[] = [];
  let teamMembers: { id: string; name: string; avatarUrl: string | null }[] = [];

  try {
    const [memberships, members] = await Promise.all([
      prisma.chatMember.findMany({
        where: { userId: session.user.id },
        include: {
          room: {
            include: {
              members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
              },
            },
          },
        },
        orderBy: { room: { updatedAt: "desc" } },
      }),
      prisma.user.findMany({
        where: { status: "active", NOT: { id: session.user.id } },
        select: { id: true, name: true, avatarUrl: true },
        orderBy: { name: "asc" },
      }),
    ]);

    rooms = memberships.map((m) => ({
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
      unreadCount: m.lastReadAt
        ? m.room.messages.filter((msg) => msg.createdAt > m.lastReadAt!).length
        : m.room.messages.length,
    }));
    teamMembers = members;
  } catch (err) {
    console.error("[ChatPage] DB error:", err);
  }

  return (
    <ChatPageClient
      initialRooms={rooms}
      teamMembers={teamMembers}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? ""}
      isAdmin={session.user.role === "admin"}
    />
  );
}
