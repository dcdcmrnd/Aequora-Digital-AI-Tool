import { prisma } from "@/lib/prisma";

export const PERMISSIONS = {
  PROJECTS_VIEW: "projects.view",
  PROJECTS_CREATE: "projects.create",
  PROJECTS_MANAGE: "projects.manage",
  TASKS_VIEW: "tasks.view",
  TASKS_CREATE: "tasks.create",
  TASKS_MANAGE: "tasks.manage",
  NOTES_VIEW: "notes.view",
  NOTES_CREATE: "notes.create",
  NOTES_MANAGE: "notes.manage",
  TEAM_VIEW: "team.view",
  AI_TASK_ASSISTANT: "ai.task_assistant",
  AI_CONSULTANT: "ai.consultant",
  ADMIN_USERS: "admin.users",
  ADMIN_SETTINGS: "admin.settings",
} as const;

export type PermissionType = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const DEFAULT_MEMBER_PERMISSIONS: PermissionType[] = [
  PERMISSIONS.PROJECTS_VIEW,
  PERMISSIONS.TASKS_VIEW,
  PERMISSIONS.TASKS_CREATE,
  PERMISSIONS.NOTES_VIEW,
  PERMISSIONS.NOTES_CREATE,
  PERMISSIONS.AI_TASK_ASSISTANT,
];

export async function checkPermission(
  userId: string,
  permission: PermissionType
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user || user.status !== "active") return false;

  // Admins bypass all permission checks
  if (user.role === "admin") return true;

  const perm = await prisma.userPermission.findUnique({
    where: {
      userId_permissionType: {
        userId,
        permissionType: permission,
      },
    },
  });

  return !!perm;
}

export async function hasProjectAccess(
  userId: string,
  projectId: string,
  minLevel: "viewer" | "contributor" | "manager" = "viewer"
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return false;
  if (user.role === "admin") return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { isPrivate: true },
  });

  if (!project) return false;

  const access = await prisma.projectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    select: { accessLevel: true },
  });

  if (!project.isPrivate && !access) {
    // Public project — all active users with projects.view can see it
    return minLevel === "viewer";
  }

  if (!access) return false;

  const levels = ["viewer", "contributor", "manager"];
  return levels.indexOf(access.accessLevel) >= levels.indexOf(minLevel);
}

export async function getAccessibleProjectIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return [];

  if (user.role === "admin") {
    const projects = await prisma.project.findMany({ select: { id: true } });
    return projects.map((p) => p.id);
  }

  const [privateAccess, publicProjects] = await Promise.all([
    prisma.projectAccess.findMany({
      where: { userId },
      select: { projectId: true },
    }),
    prisma.project.findMany({
      where: { isPrivate: false },
      select: { id: true },
    }),
  ]);

  const ids = new Set([
    ...privateAccess.map((a) => a.projectId),
    ...publicProjects.map((p) => p.id),
  ]);

  return Array.from(ids);
}

export async function grantDefaultPermissions(userId: string): Promise<void> {
  await Promise.all(
    DEFAULT_MEMBER_PERMISSIONS.map((perm) =>
      prisma.userPermission.upsert({
        where: { userId_permissionType: { userId, permissionType: perm } },
        update: {},
        create: { userId, permissionType: perm },
      })
    )
  );
}
