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

  const [project, access, userPerms] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { isPrivate: true } }),
    prisma.projectAccess.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { accessLevel: true },
    }),
    prisma.userPermission.findMany({ where: { userId }, select: { permissionType: true } }),
  ]);

  if (!project) return false;

  const permSet = new Set(userPerms.map((p) => p.permissionType));
  const levels = ["viewer", "contributor", "manager"] as const;

  // Effective level from global permissions
  const globalLevel: typeof levels[number] =
    permSet.has("tasks.manage") || permSet.has("projects.manage")
      ? "manager"
      : permSet.has("tasks.create") || permSet.has("notes.create")
      ? "contributor"
      : "viewer";

  if (!access) {
    // Private project with no explicit access — deny
    if (project.isPrivate) return false;
    // Public project — use global permission level
    const canViewPublic = permSet.has("projects.view") || permSet.has("tasks.view");
    if (!canViewPublic) return false;
    return levels.indexOf(globalLevel) >= levels.indexOf(minLevel);
  }

  // Has explicit project access — elevate with global permissions
  const effectiveIdx = Math.max(
    levels.indexOf(access.accessLevel as typeof levels[number]),
    levels.indexOf(globalLevel)
  );
  return effectiveIdx >= levels.indexOf(minLevel);
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
