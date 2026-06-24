import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission, hasProjectAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const categoryId = searchParams.get("categoryId");
  const pinned = searchParams.get("pinned");

  const canView = session.user.role === "admin" ||
    await checkPermission(session.user.id, "notes.view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const where: Record<string, unknown> = {
    authorId: session.user.role === "admin" ? undefined : session.user.id,
    ...(projectId && { projectId }),
    ...(categoryId && { categoryId }),
    ...(pinned === "true" && { isPinned: true }),
  };

  const notes = await prisma.note.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = session.user.role === "admin" ||
    await checkPermission(session.user.id, "notes.create");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, content, projectId, categoryId } = body;

  if (!title) return NextResponse.json({ error: "Title required." }, { status: 400 });

  if (projectId) {
    const canAccess = await hasProjectAccess(session.user.id, projectId, "contributor");
    if (!canAccess && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const note = await prisma.note.create({
    data: {
      title,
      content: content || "",
      projectId: projectId || null,
      categoryId: categoryId || null,
      authorId: session.user.id,
    },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "note",
    entityId: note.id,
    entityName: note.title,
  });

  return NextResponse.json({ note }, { status: 201 });
}
