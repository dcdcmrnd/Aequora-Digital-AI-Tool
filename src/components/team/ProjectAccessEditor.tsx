"use client";

import { useEffect, useState } from "react";
import type { Project, AccessLevel } from "@/types";

interface ProjectAccessEntry {
  projectId: string;
  accessLevel: AccessLevel;
}

interface Props {
  selected: ProjectAccessEntry[];
  onChange: (entries: ProjectAccessEntry[]) => void;
  disabled?: boolean;
}

export function ProjectAccessEditor({ selected, onChange, disabled }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  const isSelected = (projectId: string) =>
    selected.some((s) => s.projectId === projectId);

  const getLevel = (projectId: string): AccessLevel =>
    selected.find((s) => s.projectId === projectId)?.accessLevel ?? "viewer";

  const toggle = (projectId: string) => {
    if (disabled) return;
    if (isSelected(projectId)) {
      onChange(selected.filter((s) => s.projectId !== projectId));
    } else {
      onChange([...selected, { projectId, accessLevel: "contributor" }]);
    }
  };

  const setLevel = (projectId: string, level: AccessLevel) => {
    if (disabled) return;
    onChange(
      selected.map((s) =>
        s.projectId === projectId ? { ...s, accessLevel: level } : s
      )
    );
  };

  if (projects.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No projects yet. Projects you create will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div key={project.id} className="flex items-center gap-3">
          <label className={`flex items-center gap-2 flex-1 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
            <input
              type="checkbox"
              checked={isSelected(project.id)}
              onChange={() => toggle(project.id)}
              disabled={disabled}
              className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
            />
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <span className="text-sm text-text-primary">{project.name}</span>
          </label>

          {isSelected(project.id) && (
            <select
              value={getLevel(project.id)}
              onChange={(e) => setLevel(project.id, e.target.value as AccessLevel)}
              disabled={disabled}
              className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="viewer">Viewer</option>
              <option value="contributor">Contributor</option>
              <option value="manager">Manager</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
