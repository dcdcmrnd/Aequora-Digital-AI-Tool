import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { NotesListView } from "@/components/notes/NotesListView";

export default async function NotesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = await checkPermission(session.user.id, "notes.view");
  if (!canView && session.user.role !== "admin") redirect("/");

  const canCreate = session.user.role === "admin" ||
    await checkPermission(session.user.id, "notes.create");

  const [notes, categories, projectAccess] = await Promise.all([
    prisma.note.findMany({
      where: { authorId: session.user.id },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        project: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.projectAccess.findMany({
      where: { userId: session.user.id },
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  const serialized = notes.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  return (
    <NotesListView
      notes={serialized as any}
      categories={categories}
      projects={projectAccess.map((a) => a.project)}
      canCreate={canCreate}
    />
  );
}
