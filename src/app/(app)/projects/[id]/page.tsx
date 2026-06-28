import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasProjectAccess, checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ProjectPage } from "@/components/projects/ProjectPage";

export default async function SingleProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = await hasProjectAccess(session.user.id, params.id, "viewer");
  if (!canView) redirect("/projects");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      projectAccess: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        },
      },
    },
  });

  if (!project) redirect("/projects");

  const isAdmin = session.user.role === "admin";
  let myAccess: "viewer" | "contributor" | "manager";

  if (isAdmin) {
    myAccess = "manager";
  } else {
    const explicitAccess = project.projectAccess.find(
      (a) => a.userId === session.user.id
    )?.accessLevel as "viewer" | "contributor" | "manager" | undefined;

    const [canCreateTasks, canManageTasks] = await Promise.all([
      checkPermission(session.user.id, "tasks.create"),
      checkPermission(session.user.id, "tasks.manage"),
    ]);

    const levels = ["viewer", "contributor", "manager"] as const;
    const globalLevel: (typeof levels)[number] = canManageTasks
      ? "manager"
      : canCreateTasks
      ? "contributor"
      : "viewer";

    const explicitIdx = explicitAccess !== undefined ? levels.indexOf(explicitAccess) : 0;
    const globalIdx = levels.indexOf(globalLevel);
    myAccess = levels[Math.max(explicitIdx, globalIdx)];
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: params.id },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
      subtasks: { select: { id: true, status: true } },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  // Users who can be assigned to tasks in this project
  const assignableUsers = await prisma.user.findMany({
    where: {
      status: "active",
      OR: [
        { role: "admin" },
        { projectAccess: { some: { projectId: params.id } } },
      ],
    },
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });

  const serialized = {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    owner: project.owner,
    projectAccess: project.projectAccess.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  const serializedTasks = tasks.map((t) => ({
    ...t,
    tags: JSON.parse(t.tags || "[]"),
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    subtasks: t.subtasks,
  }));

  return (
    <ProjectPage
      project={serialized as any}
      tasks={serializedTasks as any}
      assignableUsers={assignableUsers}
      myAccess={myAccess as "viewer" | "contributor" | "manager"}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? ""}
    />
  );
}
