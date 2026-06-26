import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      status: true,
      invitedAt: true,
      activatedAt: true,
      createdAt: true,
      permissions: { select: { permissionType: true } },
      projectAccess: {
        select: {
          projectId: true,
          accessLevel: true,
          project: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      ...user,
      permissions: user.permissions.map((p) => p.permissionType),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (params.id === session.user.id)
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

  // Prevent deleting the last admin
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (target.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1)
      return NextResponse.json({ error: "Cannot delete the only admin account." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const adminId = session.user.id;
    const userId = params.id;

    // Unassign tasks
    await tx.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
    // Transfer task ownership to current admin
    await tx.task.updateMany({ where: { creatorId: userId }, data: { creatorId: adminId } });
    // Transfer project ownership
    await tx.project.updateMany({ where: { ownerId: userId }, data: { ownerId: adminId } });
    // Transfer calendar events
    await tx.calendarEvent.updateMany({ where: { createdById: userId }, data: { createdById: adminId } });
    // Transfer chat room ownership
    await tx.chatRoom.updateMany({ where: { createdById: userId }, data: { createdById: adminId } });
    // Transfer company documents
    await tx.companyDocument.updateMany({ where: { uploadedById: userId }, data: { uploadedById: adminId } });
    // Transfer note authorship
    await tx.note.updateMany({ where: { authorId: userId }, data: { authorId: adminId } });
    // Delete chat messages (no nullable senderId)
    await tx.chatMessage.deleteMany({ where: { senderId: userId } });
    // Delete activity logs and invitations sent by this user
    await tx.activityLog.deleteMany({ where: { userId } });
    await tx.invitation.deleteMany({ where: { invitedById: userId } });
    // Delete the user (cascades: permissions, project access, notifications, chat members, etc.)
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, role, status } = body;

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(role && { role }),
      ...(status && { status }),
    },
    select: { id: true, name: true, role: true, status: true },
  });

  return NextResponse.json({ user: updated });
}
