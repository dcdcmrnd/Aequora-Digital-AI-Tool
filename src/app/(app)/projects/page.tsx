import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission, getAccessibleProjectIds } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = await checkPermission(session.user.id, "projects.view");
  if (!canView && session.user.role !== "admin") redirect("/");

  const projectIds = await getAccessibleProjectIds(session.user.id);

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, status: { not: "archived" } },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const canCreate = session.user.role === "admin" ||
    (await checkPermission(session.user.id, "projects.create"));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {projects.length} active {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-[#0d6b78] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-border rounded-card p-12 text-center">
          <p className="text-text-muted text-sm">No projects yet.</p>
          {canCreate && (
            <Link href="/projects/new" className="mt-3 inline-block text-brand-primary text-sm hover:underline">
              Create your first project
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="bg-white border border-border rounded-card p-5 hover:border-brand-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <h3 className="text-sm font-semibold text-text-primary">{project.name}</h3>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                {project.description && (
                  <p className="text-xs text-text-secondary mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{project._count.tasks} tasks</span>
                  <span>{project.owner.name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
