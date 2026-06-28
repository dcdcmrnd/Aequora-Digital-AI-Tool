"use client";

import { useState } from "react";
import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import type { Task } from "@/types";
import toast from "react-hot-toast";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Props {
  tasks: Task[];
  projects: Project[];
  canCreate: boolean;
  currentUserId: string;
}

export function MyTasksView({ tasks: initialTasks, projects, canCreate, currentUserId }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

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

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowCreate(false);
    toast.success("Task created!");
  };

  // Projects present in current task list (for the filter dropdown)
  const taskProjects = Array.from(
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
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">My Tasks</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {filtered.length} open {filtered.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">All Projects</option>
            {taskProjects.map((p) => (
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
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-brand-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Task
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-card p-12 text-center">
          <p className="text-text-muted text-sm">
            {tasks.length === 0 ? "No tasks assigned to you yet." : "No tasks match the current filters."}
          </p>
          {canCreate && tasks.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-brand-primary text-sm hover:underline"
            >
              Create your first task
            </button>
          )}
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

      {/* Create task modal */}
      {showCreate && (
        <CreateTaskModal
          projects={projects}
          currentUserId={currentUserId}
          onCreated={handleTaskCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

interface CreateTaskModalProps {
  projects: Project[];
  currentUserId: string;
  onCreated: (task: Task) => void;
  onClose: () => void;
}

function CreateTaskModal({ projects, currentUserId, onCreated, onClose }: CreateTaskModalProps) {
  const [form, setForm] = useState({
    title: "",
    projectId: projects[0]?.id ?? "",
    priority: "medium",
    dueDate: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required."); return; }
    if (!form.projectId) { toast.error("Please select a project."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          projectId: form.projectId,
          priority: form.priority,
          dueDate: form.dueDate || null,
          description: form.description || null,
          assigneeId: currentUserId,
          status: "todo",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create task.");
        return;
      }

      onCreated(data.task);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">New Task</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors rounded"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Task Title <span className="text-danger">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Project <span className="text-danger">*</span>
            </label>
            {projects.length === 0 ? (
              <p className="text-sm text-text-muted">No projects available. Ask your admin for project access.</p>
            ) : (
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Priority + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Description <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add more details…"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.projectId}
              className="flex-1 py-2 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : "Create Task"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border text-sm font-medium rounded-btn hover:bg-surface-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
