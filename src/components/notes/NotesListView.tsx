"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, cn } from "@/lib/utils";
import type { Note } from "@/types";
import toast from "react-hot-toast";

interface Props {
  notes: Note[];
  categories: { id: string; name: string; color: string; icon: string | null }[];
  projects: { id: string; name: string }[];
  canCreate: boolean;
}

export function NotesListView({ notes: initialNotes, categories, projects, canCreate }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const filtered = notes.filter((n) => {
    if (showPinned) return n.isPinned;
    if (activeCategoryId) return n.categoryId === activeCategoryId;
    return true;
  });

  const handleCreate = async (title: string, categoryId: string, projectId: string) => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled",
          categoryId: categoryId || undefined,
          projectId: projectId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create note."); return; }
      router.push(`/notes/${data.note.id}`);
    } catch {
      toast.error("Failed to create note.");
    }
  };

  const handleDelete = async (noteId: string, noteTitle: string) => {
    if (!confirm(`Delete "${noteTitle}"?`)) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted.");
    } catch {
      toast.error("Failed to delete note.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Notes</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {filtered.length} {filtered.length === 1 ? "note" : "notes"}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-[#0d6b78] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Note
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Category sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="space-y-0.5">
            <SidebarItem
              label="All Notes"
              count={notes.length}
              active={!activeCategoryId && !showPinned}
              onClick={() => { setActiveCategoryId(null); setShowPinned(false); }}
            />
            <SidebarItem
              label="Pinned"
              count={notes.filter((n) => n.isPinned).length}
              active={showPinned}
              onClick={() => { setShowPinned(true); setActiveCategoryId(null); }}
            />
            {categories.length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide px-2">Categories</p>
                </div>
                {categories.map((cat) => (
                  <SidebarItem
                    key={cat.id}
                    label={cat.name}
                    icon={cat.icon ?? undefined}
                    color={cat.color}
                    count={notes.filter((n) => n.categoryId === cat.id).length}
                    active={activeCategoryId === cat.id}
                    onClick={() => { setActiveCategoryId(cat.id); setShowPinned(false); }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="bg-white border border-border rounded-card p-12 text-center">
              <p className="text-text-muted text-sm">
                {notes.length === 0 ? "No notes yet. Create your first one." : "No notes in this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((note) => (
                <div
                  key={note.id}
                  onClick={() => router.push(`/notes/${note.id}`)}
                  className="bg-white border border-border rounded-card p-4 hover:border-brand-primary/30 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {note.isPinned && (
                          <svg className="w-3 h-3 text-warning flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                          </svg>
                        )}
                        <h3 className="text-sm font-medium text-text-primary truncate">{note.title}</h3>
                      </div>
                      {note.content && (
                        <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                          {note.content.replace(/[#*`_[\]!]/g, "").replace(/\n/g, " ").slice(0, 140)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {note.category && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: note.category.color + "20", color: note.category.color }}
                          >
                            {note.category.icon ?? ""} {note.category.name}
                          </span>
                        )}
                        {note.project && (
                          <span className="text-xs text-text-muted">{note.project.name}</span>
                        )}
                        <span className="text-xs text-text-muted">{formatDate(note.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(note.id, note.title); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewNoteModal
          categories={categories}
          projects={projects}
          onSubmit={handleCreate}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}

function SidebarItem({
  label, icon, color, count, active, onClick,
}: {
  label: string; icon?: string; color?: string; count: number; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-btn text-sm transition-colors",
        active
          ? "bg-brand-primary/10 text-brand-primary font-medium"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        {icon && <span>{icon}</span>}
        {!icon && color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
        <span className="truncate">{label}</span>
      </span>
      {count > 0 && <span className="text-xs text-text-muted flex-shrink-0">{count}</span>}
    </button>
  );
}

function NewNoteModal({
  categories, projects, onSubmit, onClose,
}: {
  categories: { id: string; name: string; icon: string | null }[];
  projects: { id: string; name: string }[];
  onSubmit: (title: string, categoryId: string, projectId: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(title, categoryId, projectId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-text-primary mb-4">New Note</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title…"
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ?? ""} {c.name}</option>
                ))}
              </select>
            </div>
          )}
          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-[#0d6b78] disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating…" : "Create Note"}
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
