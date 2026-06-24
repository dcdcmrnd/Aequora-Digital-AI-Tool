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

  const access = await prisma.projectAccess.findMany({
    where: { userId: params.id },
    include: {
      project: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json({ access });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission && session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const {
    projectAccess,
  }: { projectAccess: { projectId: string; accessLevel: string }[] } =
    await req.json();

  // Replace all project access for this user
  await prisma.$transaction(async (tx) => {
    await tx.projectAccess.deleteMany({ where: { userId: params.id } });
    if (projectAccess.length > 0) {
      await tx.projectAccess.createMany({
        data: projectAccess.map((pa) => ({
          userId: params.id,
          projectId: pa.projectId,
          accessLevel: pa.accessLevel,
          grantedById: session.user.id,
        })),
      });
    }
  });

  return NextResponse.json({ success: true });
}
