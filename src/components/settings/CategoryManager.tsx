"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/types";
import toast from "react-hot-toast";

const COLORS = [
  "#0F7B8A", "#3B82F6", "#10B981", "#8B5CF6",
  "#F59E0B", "#EF4444", "#EC4899", "#06B6D4",
  "#84CC16", "#F97316", "#6B7280", "#64748B",
];

const ICONS = ["📋", "📖", "🏢", "💡", "📚", "🎯", "🔧", "📊", "✉️", "🚀", "💼", "🗂️"];

interface CategoryWithCount extends Category {
  _count: { notes: number };
}

interface Props {
  categories: CategoryWithCount[];
}

export function CategoryManager({ categories: initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", color: COLORS[0], icon: "", description: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create."); return; }
      setCategories((prev) => [...prev, { ...data.category, _count: { notes: 0 } }]);
      setForm({ name: "", color: COLORS[0], icon: "", description: "" });
      setShowForm(false);
      toast.success("Category created.");
    } catch {
      toast.error("Failed to create category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string, noteCount: number) => {
    if (noteCount > 0) {
      if (!confirm(`Delete "${name}"? The ${noteCount} note${noteCount !== 1 ? "s" : ""} in this category will be uncategorized.`)) return;
    } else {
      if (!confirm(`Delete "${name}"?`)) return;
    }
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted.");
    } catch {
      toast.error("Failed to delete category.");
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Note Categories</h2>
          <p className="text-xs text-text-muted mt-0.5">Organize notes by category</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>Add Category</Button>
      </div>

      <div className="bg-white border border-border rounded-card divide-y divide-border">
        {categories.length === 0 && (
          <p className="px-4 py-8 text-sm text-text-muted text-center">No categories yet.</p>
        )}
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className="w-8 h-8 rounded-btn flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: cat.color + "20" }}
            >
              {cat.icon ?? <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{cat.name}</p>
              {cat.description && (
                <p className="text-xs text-text-muted truncate">{cat.description}</p>
              )}
            </div>
            <span className="text-xs text-text-muted flex-shrink-0">
              {cat._count.notes} {cat._count.notes === 1 ? "note" : "notes"}
            </span>
            <button
              onClick={() => handleDelete(cat.id, cat.name, cat._count.notes)}
              className="text-text-muted hover:text-danger transition-colors p-1 flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-card shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text-primary mb-4">New Category</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c} type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110 ring-offset-1"
                      style={{ backgroundColor: c, outline: form.color === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Icon (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, icon: "" })}
                    className={`w-8 h-8 rounded border text-xs flex items-center justify-center transition-colors ${!form.icon ? "border-brand-primary bg-brand-primary/10" : "border-border hover:border-text-muted"}`}
                  >
                    —
                  </button>
                  {ICONS.map((icon) => (
                    <button
                      key={icon} type="button"
                      onClick={() => setForm({ ...form, icon })}
                      className={`w-8 h-8 rounded border text-base flex items-center justify-center transition-colors ${form.icon === icon ? "border-brand-primary bg-brand-primary/10" : "border-border hover:border-text-muted"}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" loading={saving} className="flex-1">Create</Button>
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
