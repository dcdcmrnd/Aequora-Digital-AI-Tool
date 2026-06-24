"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { Note } from "@/types";
import toast from "react-hot-toast";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MarkdownPreview = dynamic(() => import("@uiw/react-markdown-preview"), { ssr: false });

interface Props {
  note: Note;
  categories: { id: string; name: string; color: string; icon: string | null }[];
  projects: { id: string; name: string }[];
  canEdit: boolean;
}

export function NoteEditorPage({ note: initialNote, categories, projects, canEdit }: Props) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (updates: Partial<Note>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Save failed."); return; }
      setNote(data.note);
      setLastSaved(new Date());
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [note.id]);

  const debouncedSave = useCallback((updates: Partial<Note>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(updates), 800);
  }, [save]);

  const handleContentChange = (value: string | undefined) => {
    if (!canEdit) return;
    const content = value ?? "";
    setNote((prev) => ({ ...prev, content }));
    debouncedSave({ content });
  };

  const handleTitleChange = (title: string) => {
    setNote((prev) => ({ ...prev, title }));
    debouncedSave({ title });
  };

  const handleMetaChange = (field: string, value: string | boolean | null) => {
    setNote((prev) => ({ ...prev, [field]: value }));
    save({ [field]: value });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Note deleted.");
      router.push("/notes");
    } catch {
      toast.error("Failed to delete note.");
    }
  };

  return (
    <div className="-mx-6 -my-6 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/notes" className="text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-xs text-text-muted">Notes</span>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-text-muted">Saving…</span>}
          {!saving && lastSaved && (
            <span className="text-xs text-text-muted">Saved {formatDate(lastSaved.toISOString())}</span>
          )}
          <button
            onClick={() => handleMetaChange("isPinned", !note.isPinned)}
            className={`p-1.5 rounded transition-colors ${note.isPinned ? "text-warning" : "text-text-muted hover:text-warning"}`}
            title={note.isPinned ? "Unpin" : "Pin"}
          >
            <PinIcon filled={note.isPinned} />
          </button>
          {canEdit && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-text-muted hover:text-danger transition-colors rounded"
              title="Delete note"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Title */}
          <input
            value={note.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={!canEdit}
            placeholder="Untitled"
            className="w-full text-2xl font-semibold text-text-primary bg-transparent border-none outline-none placeholder-text-muted mb-4 disabled:cursor-default"
          />

          {/* Markdown editor */}
          <div data-color-mode="light" className="min-h-[60vh]">
            {canEdit ? (
              <MDEditor
                value={note.content}
                onChange={handleContentChange}
                preview="live"
                height={600}
                style={{ border: "none", boxShadow: "none" }}
                textareaProps={{ placeholder: "Write your note here…" }}
              />
            ) : (
              <MarkdownPreview
                source={note.content || "*No content*"}
                style={{ background: "transparent", padding: 0 }}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-60 flex-shrink-0 border-l border-border bg-white overflow-y-auto p-4 space-y-5">
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">Category</p>
            <select
              value={note.categoryId ?? ""}
              onChange={(e) => handleMetaChange("categoryId", e.target.value || null)}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ?? ""} {c.name}</option>
              ))}
            </select>
          </div>

          {projects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5">Project</p>
              <select
                value={note.projectId ?? ""}
                onChange={(e) => handleMetaChange("projectId", e.target.value || null)}
                disabled={!canEdit}
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-3 border-t border-border text-xs text-text-muted space-y-1.5">
            <p>By <span className="text-text-secondary">{note.author.name}</span></p>
            <p>Created {formatDate(note.createdAt)}</p>
            <p>Updated {formatDate(note.updatedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
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
