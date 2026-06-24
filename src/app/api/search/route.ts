import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIds = await getAccessibleProjectIds(session.user.id);

  const [tasks, notes, projects] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: { in: projectIds }, status: { not: "done" } },
      select: { id: true, title: true, status: true, priority: true, projectId: true,
        project: { select: { name: true, color: true } } },
      take: 200,
    }),
    prisma.note.findMany({
      where: { authorId: session.user.id },
      select: { id: true, title: true, content: true, updatedAt: true,
        category: { select: { name: true, color: true } } },
      take: 200,
    }),
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, description: true, status: true, color: true },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    tasks: tasks.map((t) => ({ ...t, type: "task" as const })),
    notes: notes.map((n) => ({
      ...n,
      updatedAt: n.updatedAt.toISOString(),
      type: "note" as const,
    })),
    projects: projects.map((p) => ({ ...p, type: "project" as const })),
  });
}
