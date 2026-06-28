"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "./KanbanBoard";
import { TaskListView } from "./TaskListView";
import { ProjectMembersTab } from "./ProjectMembersTab";
import { ProjectSettingsTab } from "./ProjectSettingsTab";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Task, Project, AccessLevel } from "@/types";
import toast from "react-hot-toast";

interface Props {
  project: Project & { projectAccess: any[] };
  tasks: Task[];
  assignableUsers: { id: string; name: string; avatarUrl: string | null }[];
  myAccess: AccessLevel;
  currentUserId: string;
  currentUserName: string;
}

type TabType = "board" | "list" | "members" | "settings";

export function ProjectPage({
  project: initialProject,
  tasks: initialTasks,
  assignableUsers,
  myAccess,
  currentUserId,
  currentUserName,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("board");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [project, setProject] = useState(initialProject);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  const canEdit = myAccess === "contributor" || myAccess === "manager";
  const canManage = myAccess === "manager";

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: string) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: newStatus as Task["status"], completedAt: newStatus === "done" ? new Date().toISOString() : null }
            : t
        )
      );

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Rollback
        setTasks(initialTasks);
        toast.error("Failed to update task status.");
      }
    },
    [initialTasks]
  );

  const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    // Re-fetch task detail after save
  }, []);

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setSelectedTaskId(task.id);
    setCreatingTask(false);
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskId(null);
  };

  const tabs: { key: TabType; label: string; hidden?: boolean }[] = [
    { key: "board", label: "Board" },
    { key: "list", label: "List" },
    { key: "members", label: "Members", hidden: !canManage },
    { key: "settings", label: "Settings", hidden: !canManage },
  ];

  return (
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Project header */}
      <div className="px-6 py-4 bg-white border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-lg font-semibold text-text-primary truncate">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreatingTask(true)}>
            <PlusIcon />
            Add Task
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-border flex-shrink-0">
        <div className="flex px-6 gap-1">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto">
          {tab === "board" && (
            <KanbanBoard
              tasks={tasks}
              canEdit={canEdit}
              onStatusChange={handleTaskStatusChange}
              onTaskClick={setSelectedTaskId}
              assignableUsers={assignableUsers}
              projectId={project.id}
              onTaskCreated={handleTaskCreated}
              createForStatus={creatingTask ? "todo" : null}
              onCancelCreate={() => setCreatingTask(false)}
            />
          )}
          {tab === "list" && (
            <TaskListView
              tasks={tasks}
              canEdit={canEdit}
              onTaskClick={setSelectedTaskId}
              onStatusChange={handleTaskStatusChange}
            />
          )}
          {tab === "members" && canManage && (
            <div className="p-6">
              <ProjectMembersTab
                projectId={project.id}
                members={project.projectAccess}
                currentUserId={currentUserId}
              />
            </div>
          )}
          {tab === "settings" && canManage && (
            <div className="p-6">
              <ProjectSettingsTab
                project={project}
                onUpdate={(updated) => setProject({ ...project, ...updated })}
                onDelete={() => router.push("/projects")}
              />
            </div>
          )}
        </div>

        {/* Task detail slide-over */}
        {(selectedTaskId || creatingTask) && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            projectId={project.id}
            canEdit={canEdit}
            assignableUsers={assignableUsers}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onClose={() => { setSelectedTaskId(null); setCreatingTask(false); }}
            onUpdate={handleTaskUpdate}
            onDeleted={handleTaskDeleted}
            onCreated={handleTaskCreated}
            isCreating={creatingTask && !selectedTaskId}
          />
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
