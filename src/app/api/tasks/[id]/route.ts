import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasProjectAccess } from "@/lib/permissions";
import { logActivity, createNotification } from "@/lib/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
      subtasks: {
        include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView = await hasProjectAccess(session.user.id, task.projectId, "viewer");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ task: { ...task, tags: JSON.parse(task.tags || "[]") } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { projectId: true, title: true, assigneeId: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit = await hasProjectAccess(session.user.id, task.projectId, "contributor");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    title,
    description,
    status,
    priority,
    assigneeId,
    dueDate,
    tags,
    completedAt,
  } = body;

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(tags !== undefined && { tags: JSON.stringify(tags) }),
      ...(completedAt !== undefined && {
        completedAt: completedAt ? new Date(completedAt) : null,
      }),
      // Auto-set completedAt when status changes to done
      ...(status === "done" && !completedAt && { completedAt: new Date() }),
      ...(status !== "done" && status !== undefined && { completedAt: null }),
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const action = status === "done" ? "completed" : "updated";
  await logActivity({
    userId: session.user.id,
    action,
    entityType: "task",
    entityId: updated.id,
    entityName: updated.title,
    metadata: body,
  });

  // Notify new assignee
  if (
    assigneeId &&
    assigneeId !== task.assigneeId &&
    assigneeId !== session.user.id
  ) {
    await createNotification({
      userId: assigneeId,
      type: "task_assigned",
      title: "Task assigned to you",
      body: `${session.user.name} assigned you "${updated.title}"`,
      entityType: "task",
      entityId: updated.id,
    });
  }

  return NextResponse.json({
    task: { ...updated, tags: JSON.parse(updated.tags || "[]") },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { projectId: true, title: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canManage = await hasProjectAccess(session.user.id, task.projectId, "manager");
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.task.delete({ where: { id: params.id } });

  await logActivity({
    userId: session.user.id,
    action: "deleted",
    entityType: "task",
    entityId: params.id,
    entityName: task.title,
  });

  return NextResponse.json({ success: true });
}
