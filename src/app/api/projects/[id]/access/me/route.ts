import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role === "admin") {
    return NextResponse.json({ accessLevel: "manager" });
  }

  const access = await prisma.projectAccess.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: params.id,
      },
    },
    select: { accessLevel: true },
  });

  return NextResponse.json({ accessLevel: access?.accessLevel ?? null });
}
