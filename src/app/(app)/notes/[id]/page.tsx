import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NoteEditorPage } from "@/components/notes/NoteEditorPage";

export default async function NotePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const isAdmin = session.user.role === "admin";
  if (!note || (!isAdmin && note.authorId !== session.user.id)) redirect("/notes");

  const [categories, projects] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.projectAccess.findMany({
      where: { userId: session.user.id },
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  const serialized = {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };

  return (
    <NoteEditorPage
      note={serialized as any}
      categories={categories}
      projects={projects.map((a) => a.project)}
      canEdit={isAdmin || note.authorId === session.user.id}
    />
  );
}
