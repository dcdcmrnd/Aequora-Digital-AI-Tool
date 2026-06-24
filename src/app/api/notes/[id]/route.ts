import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

async function getNote(id: string) {
  return prisma.note.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const note = await getNote(params.id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && note.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    select: { authorId: true, title: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const canEdit = isAdmin || (
    note.authorId === session.user.id &&
    await checkPermission(session.user.id, "notes.create")
  );
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, content, categoryId, projectId, isPinned } = body;

  const updated = await prisma.note.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
      ...(projectId !== undefined && { projectId: projectId || null }),
      ...(isPinned !== undefined && { isPinned }),
    },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "note",
    entityId: updated.id,
    entityName: updated.title,
  });

  return NextResponse.json({ note: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    select: { authorId: true, title: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const canManage = isAdmin || (
    note.authorId === session.user.id &&
    await checkPermission(session.user.id, "notes.manage")
  );

  if (!canManage && note.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.note.delete({ where: { id: params.id } });

  await logActivity({
    userId: session.user.id,
    action: "deleted",
    entityType: "note",
    entityId: params.id,
    entityName: note.title,
  });

  return NextResponse.json({ success: true });
}
