import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TeamView } from "@/components/team/TeamView";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = await checkPermission(session.user.id, "team.view");
  const isAdmin = session.user.role === "admin";

  if (!canView && !isAdmin) redirect("/");

  const users = await prisma.user.findMany({
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
    },
    orderBy: { createdAt: "asc" },
  });

  const serialized = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "admin" | "member",
    status: u.status as "invited" | "active" | "suspended",
    avatarUrl: u.avatarUrl,
    invitedAt: u.invitedAt?.toISOString() ?? null,
    activatedAt: u.activatedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    permissions: u.permissions.map((p) => p.permissionType),
  }));

  return (
    <TeamView users={serialized} isAdmin={isAdmin} currentUserId={session.user.id} />
  );
}
