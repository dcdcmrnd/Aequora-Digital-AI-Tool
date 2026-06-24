"use client";

import { useState } from "react";
import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import type { Task } from "@/types";
import toast from "react-hot-toast";

interface Props {
  tasks: Task[];
}

export function MyTasksView({ tasks: initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const markDone = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) {
        setTasks(initialTasks);
        toast.error("Failed to mark task done.");
      } else {
        toast.success("Task completed!");
      }
    } catch {
      setTasks(initialTasks);
      toast.error("Failed to mark task done.");
    }
  };

  // Collect projects for filter
  const projects = Array.from(
    new Map(
      tasks
        .filter((t) => t.project)
        .map((t) => [t.project!.id, t.project!])
    ).values()
  );

  const filtered = tasks
    .filter((t) => filterProject === "all" || t.projectId === filterProject)
    .filter((t) => filterPriority === "all" || t.priority === filterPriority);

  const groups = [
    {
      key: "overdue",
      label: "Overdue",
      color: "text-danger",
      tasks: filtered.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart),
    },
    {
      key: "today",
      label: "Due Today",
      color: "text-warning",
      tasks: filtered.filter(
        (t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < tomorrowStart
      ),
    },
    {
      key: "week",
      label: "Due This Week",
      color: "text-blue-600",
      tasks: filtered.filter(
        (t) => t.dueDate && new Date(t.dueDate) >= tomorrowStart && new Date(t.dueDate) <= weekEnd
      ),
    },
    {
      key: "later",
      label: "Due Later",
      color: "text-text-secondary",
      tasks: filtered.filter((t) => t.dueDate && new Date(t.dueDate) > weekEnd),
    },
    {
      key: "none",
      label: "No Due Date",
      color: "text-text-muted",
      tasks: filtered.filter((t) => !t.dueDate),
    },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">My Tasks</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {filtered.length} open {filtered.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-card p-12 text-center">
          <p className="text-text-muted text-sm">No tasks to show. Nice work!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${group.color}`}>
                {group.label} · {group.tasks.length}
              </h2>
              <div className="bg-white border border-border rounded-card divide-y divide-border">
                {group.tasks.map((task) => {
                  const isOverdue = task.dueDate && new Date(task.dueDate) < todayStart;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => markDone(task.id)}
                        className="w-4 h-4 rounded border-border text-brand-primary cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.project && (
                            <Link
                              href={`/projects/${task.project.id}`}
                              className="text-xs hover:underline"
                              style={{ color: task.project.color }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {task.project.name}
                            </Link>
                          )}
                          {task.dueDate && (
                            <span className={cn("text-xs", isOverdue ? "text-danger font-medium" : "text-text-muted")}>
                              · {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
