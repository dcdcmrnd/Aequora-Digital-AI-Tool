import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasProjectAccess } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  if (isAdmin) return NextResponse.json({ members: await getAllMembers(params.id) });

  const canManage = await hasProjectAccess(session.user.id, params.id, "manager");
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ members: await getAllMembers(params.id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasProjectAccess(session.user.id, params.id, "manager");
  if (!canManage && session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, accessLevel } = await req.json();
  if (!userId || !accessLevel)
    return NextResponse.json({ error: "userId and accessLevel required." }, { status: 400 });

  const access = await prisma.projectAccess.upsert({
    where: { userId_projectId: { userId, projectId: params.id } },
    update: { accessLevel },
    create: {
      userId,
      projectId: params.id,
      accessLevel,
      grantedById: session.user.id,
    },
  });

  return NextResponse.json({ access });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasProjectAccess(session.user.id, params.id, "manager");
  if (!canManage && session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  await prisma.projectAccess.deleteMany({
    where: { userId, projectId: params.id },
  });

  return NextResponse.json({ success: true });
}

async function getAllMembers(projectId: string) {
  return prisma.projectAccess.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
    },
  });
}
