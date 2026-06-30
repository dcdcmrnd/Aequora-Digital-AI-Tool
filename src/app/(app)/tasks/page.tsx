import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission, getAccessibleProjectIds } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { MyTasksView } from "@/components/tasks/MyTasksView";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = await checkPermission(session.user.id, "tasks.view");
  if (!canView && session.user.role !== "admin") redirect("/");

  const canCreate = session.user.role === "admin" ||
    await checkPermission(session.user.id, "tasks.create");

  const projectIds = await getAccessibleProjectIds(session.user.id);

  const [tasks, projects, teamMembers] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          { assigneeId: session.user.id },
          { assignees: { some: { userId: session.user.id } } },
        ],
        projectId: { in: projectIds },
        status: { not: "done" },
        parentTaskId: null,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
    }),
    prisma.project.findMany({
      where: { id: { in: projectIds }, status: { not: "archived" } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = tasks.map((t) => ({
    ...t,
    tags: JSON.parse(t.tags || "[]"),
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <MyTasksView
      tasks={serialized as any}
      projects={projects}
      teamMembers={teamMembers}
      canCreate={canCreate}
      currentUserId={session.user.id}
    />
  );
}
