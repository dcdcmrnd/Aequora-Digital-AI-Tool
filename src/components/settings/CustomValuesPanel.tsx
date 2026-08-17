"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCustomValues } from "@/hooks/useCustomValues";
import type { CustomValue } from "@/types";

function tokenFor(key: string): string {
  return `{{custom_values.${key}}}`;
}

/**
 * GHL-style "Custom Values" manager: account-wide reusable snippets (e.g.
 * "Company Support Phone") usable anywhere as a merge tag. Table shape
 * (Name / Key / Value, search, row menu, copyable token) mirrors GHL's own
 * Settings > Custom Values screen.
 */
export function CustomValuesPanel() {
  const { values, isLoading, createValue, updateValue, deleteValue } = useCustomValues();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CustomValue | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return values;
    return values.filter((v) => v.name.toLowerCase().includes(q) || v.key.includes(q) || v.value.toLowerCase().includes(q));
  }, [values, search]);

  function handleDelete(value: CustomValue) {
    if (!confirm(`Delete "${value.name}"? Any template still referencing ${tokenFor(value.key)} will show it literally.`)) return;
    deleteValue.mutate(value.id);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Custom Values</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Reusable snippets available anywhere as a merge tag, e.g. in an automation email body.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          Add Custom Value
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Custom Values" className="pl-8" />
      </div>

      <div className="bg-white border border-border rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary text-text-secondary text-xs">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Key</th>
              <th className="px-4 py-2.5 text-left font-medium">Value</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  {values.length === 0 ? "No custom values yet." : "No custom values match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{v.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs bg-surface-secondary text-text-secondary px-1.5 py-0.5 rounded">{tokenFor(v.key)}</code>
                      <CopyButton value={tokenFor(v.key)} label="Merge tag copied" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary max-w-xs truncate">{v.value || <span className="text-text-muted">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <Dropdown
                      trigger={
                        <button className="text-text-muted hover:text-text-primary p-1" aria-label="Actions">
                          <MoreVertical className="size-4" />
                        </button>
                      }
                      items={[
                        { label: "Edit", onClick: () => setEditing(v) },
                        { label: "Delete", danger: true, onClick: () => handleDelete(v) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomValueFormModal open={creating} onClose={() => setCreating(false)} onSubmit={(name, value) => createValue.mutate({ name, value }, { onSuccess: () => setCreating(false) })} saving={createValue.isPending} />
      <CustomValueFormModal
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(name, value) => editing && updateValue.mutate({ id: editing.id, name, value }, { onSuccess: () => setEditing(null) })}
        saving={updateValue.isPending}
      />
    </section>
  );
}

function CustomValueFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  initial?: CustomValue;
  onClose: () => void;
  onSubmit: (name: string, value: string) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [value, setValue] = useState(initial?.value ?? "");

  // Re-seed whenever a different (or new) row opens -- avoids stale state bleeding between "Add" and "Edit".
  useEffect(() => {
    setName(initial?.name ?? "");
    setValue(initial?.value ?? "");
  }, [initial?.id, open]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Custom Value" : "New Custom Value"} size="sm">
      <form
        className="space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit(name.trim(), value);
        }}
      >
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Company Support Phone" />
          {initial && <p className="text-xs text-text-muted mt-1">Key {tokenFor(initial.key)} stays the same when you rename this.</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Value</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="What the merge tag resolves to" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>{initial ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
