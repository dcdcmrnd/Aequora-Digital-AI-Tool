"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/types";

interface Props {
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (id: string) => void;
  onStatusChange: (taskId: string, status: string) => Promise<void>;
}

type SortKey = "title" | "assignee" | "priority" | "dueDate" | "status";

const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function TaskListView({ tasks, canEdit, onTaskClick, onStatusChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = tasks
    .filter((t) => !t.parentTaskId)
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .filter((t) => filterPriority === "all" || t.priority === filterPriority);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "title") cmp = a.title.localeCompare(b.title);
    else if (sortKey === "assignee") cmp = (a.assignee?.name ?? "").localeCompare(b.assignee?.name ?? "");
    else if (sortKey === "priority") cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    else if (sortKey === "dueDate") {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      cmp = aDate - bDate;
    } else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className={cn("ml-1 text-[10px]", sortKey === col ? "text-brand-primary" : "text-text-muted")}>
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div className="p-4">
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary"
        >
          <option value="all">All Statuses</option>
          <option value="backlog">Backlog</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
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
        <span className="ml-auto text-xs text-text-muted self-center">
          {sorted.length} task{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {canEdit && <th className="w-8 px-3 py-2" />}
              <th
                className="text-left text-xs font-medium text-text-muted px-3 py-2 cursor-pointer hover:text-text-primary"
                onClick={() => handleSort("title")}
              >
                Title <SortIcon col="title" />
              </th>
              <th
                className="text-left text-xs font-medium text-text-muted px-3 py-2 cursor-pointer hover:text-text-primary"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon col="status" />
              </th>
              <th
                className="text-left text-xs font-medium text-text-muted px-3 py-2 cursor-pointer hover:text-text-primary"
                onClick={() => handleSort("priority")}
              >
                Priority <SortIcon col="priority" />
              </th>
              <th
                className="text-left text-xs font-medium text-text-muted px-3 py-2 cursor-pointer hover:text-text-primary"
                onClick={() => handleSort("assignee")}
              >
                Assignee <SortIcon col="assignee" />
              </th>
              <th
                className="text-left text-xs font-medium text-text-muted px-3 py-2 cursor-pointer hover:text-text-primary"
                onClick={() => handleSort("dueDate")}
              >
                Due Date <SortIcon col="dueDate" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-3 py-8 text-center text-sm text-text-muted"
                >
                  No tasks match your filters
                </td>
              </tr>
            ) : (
              sorted.map((task) => {
                const isOverdue =
                  task.dueDate &&
                  new Date(task.dueDate) < new Date() &&
                  task.status !== "done";
                return (
                  <tr
                    key={task.id}
                    className="hover:bg-surface-secondary transition-colors cursor-pointer"
                    onClick={() => onTaskClick(task.id)}
                  >
                    {canEdit && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={task.status === "done"}
                          onChange={(e) =>
                            onStatusChange(task.id, e.target.checked ? "done" : "todo")
                          }
                          className="w-3.5 h-3.5 rounded border-border text-brand-primary cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-text-muted")}>
                        {task.title}
                      </p>
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {task.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] bg-surface-secondary text-text-muted px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-3 py-2.5">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="xs" />
                          <span className="text-xs text-text-secondary">{task.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {task.dueDate ? (
                        <span className={cn("text-xs font-medium", isOverdue ? "text-danger" : "text-text-secondary")}>
                          {formatDate(task.dueDate)}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
