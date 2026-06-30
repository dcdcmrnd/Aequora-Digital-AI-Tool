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

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Props {
  tasks: Task[];
  projects: Project[];
  teamMembers: TeamMember[];
  canCreate: boolean;
  currentUserId: string;
}

function MemberAvatar({ member, size = "sm" }: { member: TeamMember; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]";
  return member.avatarUrl ? (
    <img src={member.avatarUrl} alt={member.name} className={`${dim} rounded-full object-cover border border-white`} />
  ) : (
    <div className={`${dim} rounded-full bg-brand-primary/20 flex items-center justify-center font-semibold text-brand-primary border border-white`}>
      {member.name[0].toUpperCase()}
    </div>
  );
}

export function MyTasksView({ tasks: initialTasks, projects, teamMembers, canCreate, currentUserId }: Props) {
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
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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
            <button onClick={() => setShowCreate(true)} className="mt-3 text-brand-primary text-sm hover:underline">
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
                  const extraAssignees = (task as any).assignees as { user: TeamMember }[] | undefined;
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors">
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
                      {/* Assignee avatars */}
                      {extraAssignees && extraAssignees.length > 0 && (
                        <div className="flex -space-x-1 flex-shrink-0">
                          {extraAssignees.slice(0, 3).map(({ user }) => (
                            <MemberAvatar key={user.id} member={user} size="xs" />
                          ))}
                          {extraAssignees.length > 3 && (
                            <div className="w-5 h-5 rounded-full bg-surface-secondary border border-white flex items-center justify-center text-[9px] text-text-muted">
                              +{extraAssignees.length - 3}
                            </div>
                          )}
                        </div>
                      )}
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

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          teamMembers={teamMembers}
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
  teamMembers: TeamMember[];
  currentUserId: string;
  onCreated: (task: Task) => void;
  onClose: () => void;
}

function CreateTaskModal({ projects, teamMembers, currentUserId, onCreated, onClose }: CreateTaskModalProps) {
  const [form, setForm] = useState({
    title: "",
    projectId: projects[0]?.id ?? "",
    priority: "medium",
    dueDate: "",
    description: "",
    tagInput: "",
    tags: [] as string[],
  });
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);
  const [saving, setSaving] = useState(false);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag], tagInput: "" }));
    }
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

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
          assigneeId: assigneeIds[0] || null,
          assigneeIds,
          tags: form.tags,
          status: "todo",
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create task."); return; }
      onCreated(data.task);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-text-primary">New Task</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors rounded">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title…"
              className="w-full px-0 py-1 text-lg font-semibold border-0 border-b border-transparent focus:border-brand-primary focus:outline-none text-text-primary placeholder:text-text-muted transition-colors bg-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add a description…"
              rows={3}
              className="w-full px-0 py-1 text-sm border-0 focus:outline-none text-text-secondary placeholder:text-text-muted resize-none bg-transparent"
            />
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            {/* Project */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-text-muted w-24 flex-shrink-0">Project</span>
              {projects.length === 0 ? (
                <span className="text-xs text-text-muted">No projects available.</span>
              ) : (
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="flex-1 px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Assignees */}
            <div className="flex items-start gap-3">
              <span className="text-xs font-medium text-text-muted w-24 flex-shrink-0 mt-1">Assignees</span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {assigneeIds.map((id) => {
                    const m = teamMembers.find((t) => t.id === id);
                    if (!m) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-medium">
                        {m.name}
                        <button type="button" onClick={() => toggleAssignee(id)} className="hover:text-brand-primary/60">×</button>
                      </span>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto border border-border rounded p-1.5">
                  {teamMembers.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(m.id)}
                        onChange={() => toggleAssignee(m.id)}
                        className="w-3.5 h-3.5 rounded border-border text-brand-primary"
                      />
                      <MemberAvatar member={m} size="xs" />
                      <span className="text-xs text-text-primary truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority + Due Date */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-text-muted w-24 flex-shrink-0">Priority</span>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="flex-1 px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-text-muted w-24 flex-shrink-0">Due Date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="flex-1 px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Tags */}
            <div className="flex items-start gap-3">
              <span className="text-xs font-medium text-text-muted w-24 flex-shrink-0 mt-1.5">Tags</span>
              <div className="flex-1">
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {form.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary text-xs">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-text-primary">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={form.tagInput}
                    onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Add tag…"
                    className="flex-1 px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                  <button type="button" onClick={addTag} className="px-3 py-1.5 border border-border rounded text-sm hover:bg-surface-secondary transition-colors">Add</button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-border">
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
