import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/chat/rooms/[id] — edit name / add / remove members
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.chatRoom.findUnique({
    where: { id: params.id },
    include: { members: true },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const isCreator = room.createdById === session.user.id;
  if (!isAdmin && !isCreator) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!room.isGroup) return NextResponse.json({ error: "Cannot edit DMs" }, { status: 400 });

  const { name, addMemberIds, removeMemberIds } = await req.json();

  const updates: Parameters<typeof prisma.chatRoom.update>[0]["data"] = {};
  if (typeof name === "string") updates.name = name.trim() || null;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx.chatRoom.update({ where: { id: params.id }, data: updates });
    }

    if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
      const existing = new Set(room.members.map((m) => m.userId));
      const toAdd = (addMemberIds as string[]).filter((id) => !existing.has(id));
      if (toAdd.length > 0) {
        await tx.chatMember.createMany({
          data: toAdd.map((uid) => ({ roomId: params.id, userId: uid })),
          skipDuplicates: true,
        });
      }
    }

    if (Array.isArray(removeMemberIds) && removeMemberIds.length > 0) {
      // Never remove the creator
      const toRemove = (removeMemberIds as string[]).filter((id) => id !== room.createdById);
      if (toRemove.length > 0) {
        await tx.chatMember.deleteMany({
          where: { roomId: params.id, userId: { in: toRemove } },
        });
      }
    }
  });

  // Return refreshed room
  const updated = await prisma.chatRoom.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });

  return NextResponse.json({
    room: {
      id: updated!.id,
      name: updated!.name,
      isGroup: updated!.isGroup,
      createdById: updated!.createdById,
      members: updated!.members.map((m) => m.user),
    },
  });
}

// DELETE /api/chat/rooms/[id] — delete group chat
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.chatRoom.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const isCreator = room.createdById === session.user.id;
  if (!isAdmin && !isCreator) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!room.isGroup) return NextResponse.json({ error: "Cannot delete DMs" }, { status: 400 });

  await prisma.chatRoom.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
