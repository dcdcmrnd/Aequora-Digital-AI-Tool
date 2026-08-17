"use client";

import { useMemo, useState } from "react";
import { MoreVertical, Search } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useTagsManager } from "@/hooks/useTagsManager";

/**
 * GHL-style Tags manager: every tag in use across all contacts, with a
 * count, and the ability to rename, merge several into one, or delete a tag
 * everywhere it's used -- tags aren't a table of their own (Contact.tags is
 * a plain JSON array), so every action here rewrites contacts in place.
 */
export function TagsManagerPanel() {
  const { tags, isLoading, rename, merge, remove } = useTagsManager();
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleDelete(name: string) {
    if (!confirm(`Delete tag "${name}" from every contact that has it?`)) return;
    remove.mutate(name);
  }

  function startRename(name: string) {
    setRenaming(name);
    setRenameValue(name);
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming || !renameValue.trim() || renameValue.trim() === renaming) { setRenaming(null); return; }
    rename.mutate({ from: renaming, to: renameValue.trim() }, { onSuccess: () => setRenaming(null) });
  }

  function submitMerge() {
    if (selected.size === 0 || !mergeTarget.trim()) return;
    merge.mutate(
      { sources: Array.from(selected), target: mergeTarget.trim() },
      { onSuccess: () => { setSelected(new Set()); setMergeOpen(false); setMergeTarget(""); } },
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Tags</h2>
          <p className="text-xs text-text-muted mt-0.5">Every tag currently used on a contact, with how many carry it.</p>
        </div>
        {selected.size > 0 && (
          <Button size="sm" variant="outline" onClick={() => { setMergeTarget(""); setMergeOpen(true); }}>
            Merge {selected.size} selected
          </Button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Tags" className="pl-8" />
      </div>

      <div className="bg-white border border-border rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary text-text-secondary text-xs">
            <tr>
              <th className="w-10 px-4 py-2.5" />
              <th className="px-4 py-2.5 text-left font-medium">Tag</th>
              <th className="px-4 py-2.5 text-left font-medium">Contacts</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  {tags.length === 0 ? "No tags in use yet." : "No tags match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.name} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(t.name)}
                      onChange={() => toggle(t.name)}
                      className="size-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                      aria-label={`Select ${t.name}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{t.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{t.count}</td>
                  <td className="px-4 py-2.5">
                    <Dropdown
                      trigger={
                        <button className="text-text-muted hover:text-text-primary p-1" aria-label="Actions">
                          <MoreVertical className="size-4" />
                        </button>
                      }
                      items={[
                        { label: "Rename", onClick: () => startRename(t.name) },
                        { label: "Delete", danger: true, onClick: () => handleDelete(t.name) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename "${renaming}"`} size="sm">
        <form className="space-y-4 p-6" onSubmit={submitRename}>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">New name</label>
            <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" loading={rename.isPending} disabled={!renameValue.trim()}>Rename</Button>
          </div>
        </form>
      </Modal>

      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge tags" size="sm">
        <div className="space-y-4 p-6">
          <p className="text-sm text-text-secondary">
            Merging <strong>{Array.from(selected).join(", ")}</strong> into one tag on every contact that has any of them.
          </p>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Target tag name</label>
            <Input autoFocus value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} placeholder="Existing or new tag name" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button onClick={submitMerge} loading={merge.isPending} disabled={!mergeTarget.trim()}>Merge</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
