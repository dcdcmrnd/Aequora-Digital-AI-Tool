import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { getGreeting } from "@/lib/utils";
import { DailyBriefingWidget } from "@/components/dashboard/DailyBriefingWidget";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const projectIds = await getAccessibleProjectIds(session.user.id);

  const [myOverdueTasks, myTodayTasks, myWeekTasks, recentActivity] =
    await Promise.all([
      // Overdue
      prisma.task.findMany({
        where: {
          assigneeId: session.user.id,
          projectId: { in: projectIds },
          dueDate: { lt: todayStart },
          status: { not: "done" },
        },
        include: { project: { select: { name: true, color: true } } },
        orderBy: { priority: "asc" },
        take: 10,
      }),
      // Due today
      prisma.task.findMany({
        where: {
          assigneeId: session.user.id,
          projectId: { in: projectIds },
          dueDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
          status: { not: "done" },
        },
        include: { project: { select: { name: true, color: true } } },
        orderBy: { priority: "asc" },
        take: 10,
      }),
      // This week (not overdue, not today)
      prisma.task.findMany({
        where: {
          assigneeId: session.user.id,
          projectId: { in: projectIds },
          dueDate: { gte: new Date(todayStart.getTime() + 86400000), lte: weekEnd },
          status: { not: "done" },
        },
        include: { project: { select: { name: true, color: true } } },
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
        take: 10,
      }),
      // Recent activity
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { user: { select: { name: true, avatarUrl: true } } },
      }),
    ]);

  const greeting = getGreeting();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {greeting}, {session.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <DailyBriefingWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Focus + Week */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Focus */}
          <section className="bg-white border border-border rounded-card p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger flex-shrink-0" />
              My Focus
            </h2>

            {myOverdueTasks.length === 0 && myTodayTasks.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                You&apos;re all caught up for today. Nice work.
              </p>
            ) : (
              <div className="space-y-1">
                {myOverdueTasks.map((task) => (
                  <DashboardTaskRow key={task.id} task={task} label="overdue" />
                ))}
                {myTodayTasks.map((task) => (
                  <DashboardTaskRow key={task.id} task={task} label="today" />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming this week */}
          {myWeekTasks.length > 0 && (
            <section className="bg-white border border-border rounded-card p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                Upcoming This Week
              </h2>
              <div className="space-y-1">
                {myWeekTasks.map((task) => (
                  <DashboardTaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Recent Activity */}
        <div>
          <section className="bg-white border border-border rounded-card p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              Recent Activity
            </h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex gap-2.5 text-xs">
                    <div className="w-7 h-7 rounded-full bg-surface-secondary flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-text-secondary">
                      {a.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary">
                        <span className="font-medium">{a.user.name}</span>{" "}
                        <span className="text-text-secondary">{a.action}</span>{" "}
                        <span className="font-medium">{a.entityName}</span>
                      </p>
                      <p className="text-text-muted mt-0.5">
                        {new Date(a.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {new Date(a.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DashboardTaskRow({
  task,
  label,
}: {
  task: any;
  label?: "overdue" | "today";
}) {
  const PRIORITY_DOT: Record<string, string> = {
    urgent: "bg-urgent",
    high: "bg-warning",
    medium: "bg-blue-400",
    low: "bg-text-muted",
  };

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-btn hover:bg-surface-secondary transition-colors group">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-text-muted"}`}
      />
      <span className="flex-1 text-sm text-text-primary truncate">{task.title}</span>
      {task.project && (
        <span
          className="text-xs text-text-muted px-2 py-0.5 rounded-full border border-border flex-shrink-0"
          style={{ borderColor: task.project.color + "40" }}
        >
          {task.project.name}
        </span>
      )}
      {label && (
        <span
          className={`text-xs font-medium flex-shrink-0 ${
            label === "overdue" ? "text-danger" : "text-warning"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
