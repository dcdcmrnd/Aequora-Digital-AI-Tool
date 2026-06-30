import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds, hasProjectAccess } from "@/lib/permissions";
import { logActivity, createNotification } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const assigneeId = searchParams.get("assigneeId");

  const projectIds = await getAccessibleProjectIds(session.user.id);

  const statusFilter = searchParams.get("status");
  const where: Record<string, unknown> = {
    projectId: { in: projectId ? [projectId] : projectIds },
    ...(assigneeId && { assigneeId }),
    ...(statusFilter === "!done" && { status: { not: "done" } }),
  };

  // Ensure requested projectId is accessible
  if (projectId && !projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({ ...t, tags: JSON.parse(t.tags || "[]") })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, projectId, assigneeId, dueDate, tags, parentTaskId } = body;

  if (!title || !projectId) {
    return NextResponse.json({ error: "Title and projectId are required." }, { status: 400 });
  }

  const canCreate = session.user.role === "admin" ||
    await hasProjectAccess(session.user.id, projectId, "contributor");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { assigneeIds } = body;
  const primaryAssigneeId = assigneeId || (Array.isArray(assigneeIds) && assigneeIds[0]) || null;
  const allAssigneeIds: string[] = Array.isArray(assigneeIds) ? assigneeIds : (assigneeId ? [assigneeId] : []);

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      status: status || "todo",
      priority: priority || "medium",
      projectId,
      assigneeId: primaryAssigneeId,
      creatorId: session.user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: JSON.stringify(tags || []),
      parentTaskId: parentTaskId || null,
      assignees: allAssigneeIds.length > 0
        ? { create: allAssigneeIds.map((userId: string) => ({ userId })) }
        : undefined,
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "task",
    entityId: task.id,
    entityName: task.title,
    metadata: { projectId },
  });

  // Notify all assignees different from creator
  const notifyIds = allAssigneeIds.filter((id: string) => id !== session.user.id);
  await Promise.all(
    notifyIds.map((userId: string) =>
      createNotification({
        userId,
        type: "task_assigned",
        title: "New task assigned",
        body: `${session.user.name} assigned you "${task.title}"`,
        entityType: "task",
        entityId: task.id,
      })
    )
  );

  return NextResponse.json({ task: { ...task, tags: tags || [] } }, { status: 201 });
}
