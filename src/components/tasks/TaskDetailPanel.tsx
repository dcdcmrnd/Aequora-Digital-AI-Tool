"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatDate } from "@/lib/utils";
import { TASK_STATUSES, STATUS_LABELS, PRIORITY_COLORS, type Task, type TaskStatus, type TaskPriority } from "@/types";
import toast from "react-hot-toast";

interface Props {
  taskId: string | null;
  projectId: string;
  canEdit: boolean;
  assignableUsers: { id: string; name: string; avatarUrl: string | null }[];
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDeleted: (taskId: string) => void;
  onCreated: (task: Task) => void;
  isCreating: boolean;
}

const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};

export function TaskDetailPanel({
  taskId,
  projectId,
  canEdit,
  assignableUsers,
  currentUserId,
  currentUserName,
  onClose,
  onUpdate,
  onDeleted,
  onCreated,
  isCreating,
}: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((d) => setTask(d.task ?? null))
      .catch(() => toast.error("Failed to load task."))
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleFieldSave = async (field: string, value: unknown) => {
    if (!task || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Save failed."); return; }
      setTask(data.task);
      onUpdate(task.id, data.task);
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) { toast.error("Title is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription || undefined,
          status: newStatus,
          priority: newPriority,
          projectId,
          assigneeId: newAssigneeId || undefined,
          dueDate: newDueDate || undefined,
          tags: newTags ? newTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create task."); return; }
      toast.success("Task created!");
      onCreated(data.task);
    } catch {
      toast.error("Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Task deleted.");
      onDeleted(task.id);
    } catch {
      toast.error("Failed to delete task.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 md:relative md:inset-auto md:z-auto md:w-96 md:flex-shrink-0 border-l border-border bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
        <h3 className="text-sm font-semibold text-text-primary">
          {isCreating ? "New Task" : "Task Details"}
        </h3>
        <div className="flex items-center gap-1">
          {saving && <span className="text-xs text-text-muted">Saving…</span>}
          {task && canEdit && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-text-muted hover:text-danger transition-colors rounded"
              title="Delete task"
            >
              <TrashIcon />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded"
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="p-5 text-sm text-text-muted text-center">Loading…</div>
        )}

        {/* CREATE MODE */}
        {isCreating && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Title *</label>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
              <textarea
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add a description…"
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                  className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Assignee</label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tags (comma-separated)</label>
              <input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="e.g. design, client-facing"
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} loading={saving} className="flex-1">
                Create Task
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* VIEW / EDIT MODE */}
        {task && !isCreating && (
          <div className="p-5 space-y-5">
            {/* Title */}
            <EditableTitle
              value={task.title}
              canEdit={canEdit}
              onSave={(v) => handleFieldSave("title", v)}
            />

            {/* Status + Priority row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldBlock label="Status">
                {canEdit ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleFieldSave("status", e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">{STATUS_LABELS[task.status]}</span>
                )}
              </FieldBlock>
              <FieldBlock label="Priority">
                {canEdit ? (
                  <select
                    value={task.priority}
                    onChange={(e) => handleFieldSave("priority", e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                )}
              </FieldBlock>
            </div>

            {/* Assignee */}
            <FieldBlock label="Assignee">
              {canEdit ? (
                <select
                  value={task.assigneeId ?? ""}
                  onChange={(e) => handleFieldSave("assigneeId", e.target.value || null)}
                  className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : task.assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="xs" />
                  <span className="text-sm">{task.assignee.name}</span>
                </div>
              ) : (
                <span className="text-sm text-text-muted">Unassigned</span>
              )}
            </FieldBlock>

            {/* Due Date */}
            <FieldBlock label="Due Date">
              {canEdit ? (
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.split("T")[0] : ""}
                  onChange={(e) => handleFieldSave("dueDate", e.target.value || null)}
                  className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              ) : (
                <span className="text-sm">
                  {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                </span>
              )}
            </FieldBlock>

            {/* Tags */}
            <FieldBlock label="Tags">
              {canEdit ? (
                <TagEditor
                  tags={task.tags ?? []}
                  onSave={(tags) => handleFieldSave("tags", tags)}
                />
              ) : task.tags && task.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-surface-secondary text-text-secondary px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-text-muted">No tags</span>
              )}
            </FieldBlock>

            {/* Description */}
            <FieldBlock label="Description">
              <EditableTextarea
                value={task.description ?? ""}
                canEdit={canEdit}
                placeholder="Add a description…"
                onSave={(v) => handleFieldSave("description", v || null)}
              />
            </FieldBlock>

            {/* Created by */}
            <div className="pt-2 border-t border-border text-xs text-text-muted space-y-1">
              {task.creator && (
                <p>Created by <span className="text-text-secondary">{task.creator.name}</span></p>
              )}
              <p>Created {formatDate(task.createdAt)}</p>
              {task.completedAt && (
                <p>Completed {formatDate(task.completedAt)}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function EditableTitle({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!canEdit) {
    return <h2 className="text-base font-semibold text-text-primary leading-snug">{value}</h2>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() && draft !== value) onSave(draft.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full text-base font-semibold text-text-primary border-b-2 border-brand-primary bg-transparent focus:outline-none pb-0.5"
      />
    );
  }

  return (
    <h2
      className="text-base font-semibold text-text-primary leading-snug cursor-text hover:text-brand-primary transition-colors"
      onClick={() => setEditing(true)}
    >
      {value}
    </h2>
  );
}

function EditableTextarea({ value, canEdit, placeholder, onSave }: { value: string; canEdit: boolean; placeholder: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!canEdit || !editing) {
    return (
      <div
        onClick={() => canEdit && setEditing(true)}
        className={cn(
          "text-sm text-text-secondary whitespace-pre-wrap min-h-[40px] rounded p-1 -m-1",
          canEdit && "cursor-text hover:bg-surface-secondary transition-colors"
        )}
      >
        {value || <span className="text-text-muted">{placeholder}</span>}
      </div>
    );
  }

  return (
    <textarea
      autoFocus
      value={draft}
      rows={4}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
    />
  );
}

function TagEditor({ tags, onSave }: { tags: string[]; onSave: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) { setInput(""); return; }
    onSave([...tags, trimmed]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onSave(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-xs bg-surface-secondary text-text-secondary px-2 py-0.5 rounded-full">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-text-muted hover:text-danger">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Add tag…"
          className="flex-1 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        <button onClick={addTag} className="px-2 py-1 text-xs bg-surface-secondary border border-border rounded hover:bg-surface-hover">
          Add
        </button>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
