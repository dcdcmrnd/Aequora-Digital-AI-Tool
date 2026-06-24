import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission, getAccessibleProjectIds } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIds = await getAccessibleProjectIds(session.user.id);

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = session.user.role === "admin" ||
    await checkPermission(session.user.id, "projects.create");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, color, isPrivate } = body;

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name,
        description: description || null,
        color: color || "#0F7B8A",
        isPrivate: isPrivate ?? true,
        ownerId: session.user.id,
      },
      include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Auto-add creator as manager
    await tx.projectAccess.create({
      data: {
        userId: session.user.id,
        projectId: p.id,
        accessLevel: "manager",
        grantedById: session.user.id,
      },
    });

    return p;
  });

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
  });

  return NextResponse.json({ project }, { status: 201 });
}
