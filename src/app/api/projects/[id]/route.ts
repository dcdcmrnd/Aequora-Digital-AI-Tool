import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasProjectAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasProjectAccess(session.user.id, params.id, "viewer");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      projectAccess: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        },
      },
      _count: { select: { tasks: true, notes: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get user's access level
  let userAccessLevel = null;
  if (session.user.role === "admin") {
    userAccessLevel = "manager";
  } else {
    const access = project.projectAccess.find((a) => a.userId === session.user.id);
    userAccessLevel = access?.accessLevel ?? null;
  }

  return NextResponse.json({ project: { ...project, userAccessLevel } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasProjectAccess(session.user.id, params.id, "manager");
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, status, color, isPrivate } = body;

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(color !== undefined && { color }),
      ...(isPrivate !== undefined && { isPrivate }),
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    metadata: body,
  });

  return NextResponse.json({ project });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasProjectAccess(session.user.id, params.id, "manager");
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true },
  });

  await prisma.project.delete({ where: { id: params.id } });

  await logActivity({
    userId: session.user.id,
    action: "deleted",
    entityType: "project",
    entityId: params.id,
    entityName: project?.name ?? "Unknown",
  });

  return NextResponse.json({ success: true });
}
