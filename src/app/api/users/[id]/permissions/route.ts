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

  const perms = await prisma.userPermission.findMany({
    where: { userId: params.id },
    select: { permissionType: true },
  });

  return NextResponse.json({ permissions: perms.map((p) => p.permissionType) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { permissions }: { permissions: string[] } = await req.json();

  // Replace all permissions for this user
  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: params.id } }),
    prisma.userPermission.createMany({
      data: permissions.map((p) => ({ userId: params.id, permissionType: p })),
    }),
  ]);

  return NextResponse.json({ success: true, permissions });
}
