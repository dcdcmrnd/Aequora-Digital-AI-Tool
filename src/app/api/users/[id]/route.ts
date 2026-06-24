import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
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
      projectAccess: {
        select: {
          projectId: true,
          accessLevel: true,
          project: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      ...user,
      permissions: user.permissions.map((p) => p.permissionType),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, role, status } = body;

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(role && { role }),
      ...(status && { status }),
    },
    select: { id: true, name: true, role: true, status: true },
  });

  return NextResponse.json({ user: updated });
}
