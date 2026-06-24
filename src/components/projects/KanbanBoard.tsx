"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TASK_STATUSES, STATUS_LABELS, PRIORITY_COLORS, type Task, type TaskStatus } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  tasks: Task[];
  canEdit: boolean;
  onStatusChange: (taskId: string, status: string) => Promise<void>;
  onTaskClick: (taskId: string) => void;
  assignableUsers: { id: string; name: string; avatarUrl: string | null }[];
  projectId: string;
  onTaskCreated: (task: Task) => void;
  createForStatus: string | null;
  onCancelCreate: () => void;
}

const COLUMN_BG: Record<string, string> = {
  backlog: "bg-[#F1F5F9]",
  todo: "bg-[#F1F5F9]",
  "in-progress": "bg-[#EFF6FF]",
  review: "bg-[#FFFBEB]",
  done: "bg-[#F0FDF4]",
};

const COLUMN_HEADER_COLOR: Record<string, string> = {
  backlog: "text-text-muted",
  todo: "text-text-secondary",
  "in-progress": "text-blue-600",
  review: "text-amber-600",
  done: "text-emerald-600",
};

export function KanbanBoard({
  tasks,
  canEdit,
  onStatusChange,
  onTaskClick,
  assignableUsers,
  projectId,
  onTaskCreated,
  createForStatus,
  onCancelCreate,
}: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

  // Keep local tasks in sync when prop changes
  if (tasks !== localTasks && !activeTask) {
    setLocalTasks(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = localTasks.filter((t) => t.status === status && !t.parentTaskId);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return;
    const task = localTasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !canEdit) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging over a column
    const overStatus = TASK_STATUSES.find((s) => s === overId);
    if (overStatus) {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overStatus } : t
        )
      );
    }

    // Check if dragging over another task
    const overTask = localTasks.find((t) => t.id === overId);
    if (overTask && overTask.id !== activeId) {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overTask.status } : t
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || !canEdit) { setLocalTasks(tasks); return; }

    const draggedTask = localTasks.find((t) => t.id === active.id);
    if (!draggedTask) { setLocalTasks(tasks); return; }

    // Determine the target status
    const overStatus = TASK_STATUSES.find((s) => s === over.id);
    const overTask = localTasks.find((t) => t.id === over.id);
    const targetStatus = overStatus ?? overTask?.status ?? draggedTask.status;

    if (targetStatus !== tasks.find((t) => t.id === active.id)?.status) {
      await onStatusChange(active.id as string, targetStatus);
    } else {
      setLocalTasks(tasks);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 p-4 h-full overflow-x-auto">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] ?? []}
            canEdit={canEdit}
            onTaskClick={onTaskClick}
            projectId={projectId}
            onTaskCreated={onTaskCreated}
            showCreateForm={createForStatus === status}
            onCancelCreate={onCancelCreate}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} canEdit={false} onClick={() => {}} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  canEdit,
  onTaskClick,
  projectId,
  onTaskCreated,
  showCreateForm,
  onCancelCreate,
}: {
  status: TaskStatus;
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (id: string) => void;
  projectId: string;
  onTaskCreated: (task: Task) => void;
  showCreateForm: boolean;
  onCancelCreate: () => void;
}) {
  const [showInlineCreate, setShowInlineCreate] = useState(false);

  const showCreate = showCreateForm || showInlineCreate;

  return (
    <div className={cn("flex flex-col w-64 flex-shrink-0 rounded-card", COLUMN_BG[status] ?? "bg-surface-secondary")}>
      {/* Column header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold uppercase tracking-wide", COLUMN_HEADER_COLOR[status])}>
            {STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-text-muted bg-white rounded-full px-1.5 py-0.5 font-medium">
            {tasks.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowInlineCreate(true)}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Task list */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-2 min-h-[40px]"
          data-column-id={status}
        >
          {/* Drop zone ID = status name */}
          <DropZone id={status} />

          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              canEdit={canEdit}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Inline create form */}
      {showCreate && (
        <InlineTaskCreate
          projectId={projectId}
          defaultStatus={status}
          onCreated={(task) => {
            onTaskCreated(task);
            setShowInlineCreate(false);
            onCancelCreate();
          }}
          onCancel={() => { setShowInlineCreate(false); onCancelCreate(); }}
        />
      )}
    </div>
  );
}

function DropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-1 rounded transition-all",
        isOver ? "bg-brand-primary/30 h-2" : ""
      )}
    />
  );
}

function SortableTaskCard({
  task,
  canEdit,
  onClick,
}: {
  task: Task;
  canEdit: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(canEdit ? listeners : {})}>
      <TaskCard task={task} canEdit={canEdit} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

function TaskCard({
  task,
  canEdit,
  onClick,
  isDragging,
}: {
  task: Task;
  canEdit: boolean;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "done";

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-card border border-border p-3 cursor-pointer hover:border-brand-primary/30 hover:shadow-sm transition-all text-left select-none",
        isDragging && "shadow-lg rotate-1",
        canEdit && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Priority indicator */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        />
        <p className="text-sm font-medium text-text-primary leading-snug">{task.title}</p>
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] bg-surface-secondary text-text-muted px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {task.dueDate && (
            <span
              className={cn(
                "text-[11px] font-medium",
                isOverdue ? "text-danger" : "text-text-muted"
              )}
            >
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[11px] text-text-muted">
              · {task.subtasks.filter((s: any) => s.status === "done").length}/{task.subtasks.length}
            </span>
          )}
        </div>
        {task.assignee && (
          <Avatar
            name={task.assignee.name}
            avatarUrl={task.assignee.avatarUrl}
            size="xs"
          />
        )}
      </div>
    </div>
  );
}

function InlineTaskCreate({
  projectId,
  defaultStatus,
  onCreated,
  onCancel,
}: {
  projectId: string;
  defaultStatus: string;
  onCreated: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { onCancel(); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), projectId, status: defaultStatus }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create task."); return; }
      onCreated({ ...data.task, tags: data.task.tags ?? [] });
    } catch {
      toast.error("Failed to create task.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="px-2 pb-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title..."
        className="w-full px-3 py-2 text-sm bg-white border border-brand-primary rounded-card focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
      />
      <div className="flex gap-1.5 mt-1.5">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="px-3 py-1 text-xs font-medium bg-brand-primary text-white rounded-btn hover:bg-[#0d6b78] disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
