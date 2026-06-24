"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Project } from "@/types";
import toast from "react-hot-toast";

const PROJECT_COLORS = [
  "#0F7B8A", "#3B82F6", "#10B981", "#8B5CF6",
  "#F59E0B", "#EF4444", "#EC4899", "#06B6D4",
  "#84CC16", "#F97316",
];

interface Props {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
  onDelete: () => void;
}

export function ProjectSettingsTab({ project, onUpdate, onDelete }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    color: project.color,
    isPrivate: project.isPrivate,
  });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Project name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save."); return; }
      onUpdate(data.project);
      toast.success("Project settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${project.name}"? Tasks will be preserved but the project will be hidden from active views.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Project archived.");
      onDelete();
    } catch {
      toast.error("Failed to archive project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${project.name}"? All tasks and notes in this project will be deleted. This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Project deleted.");
      onDelete();
    } catch {
      toast.error("Failed to delete project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-sm font-semibold text-text-primary">Project Settings</h2>

      <div className="bg-white border border-border rounded-card p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm({ ...form, color })}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
              >
                {form.color === color && (
                  <svg className="w-full h-full text-white p-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
              className="w-4 h-4 rounded border-border text-brand-primary"
            />
            <div>
              <p className="text-sm font-medium text-text-primary">Private project</p>
              <p className="text-xs text-text-muted">Only team members you add can see this project</p>
            </div>
          </label>
        </div>
        <Button onClick={handleSave} loading={saving}>Save Changes</Button>
      </div>

      {/* Danger zone */}
      <div className="bg-white border border-danger/30 rounded-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-danger">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Archive project</p>
            <p className="text-xs text-text-muted">Hides from active views, preserves all data.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleArchive} loading={saving}>
            Archive
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Delete project</p>
            <p className="text-xs text-text-muted">Permanently deletes all tasks and notes.</p>
          </div>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
