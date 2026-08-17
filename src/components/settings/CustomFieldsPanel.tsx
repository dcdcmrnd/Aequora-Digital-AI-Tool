"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useCustomFields } from "@/hooks/useCustomFields";
import type { CustomFieldDefinition, CustomFieldType } from "@/types";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  textarea: "Text Area",
};

// Plain key, not a {{...}} merge token: unlike Custom Values, a Custom
// Field's value isn't (yet) wired into the automation engine's merge tags --
// this identifies the field on the Contact form/API, nothing more.
function keyFor(key: string): string {
  return key;
}

/**
 * GHL-style "Custom Fields" manager: user-defined fields on Contact records
 * (text/number/date/dropdown/checkbox/textarea), each with a Unique Key
 * shown here for reference -- same purpose as GHL's field builder.
 */
export function CustomFieldsPanel() {
  const { fields, isLoading, createField, updateField, deleteField } = useCustomFields();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.name.toLowerCase().includes(q) || f.key.includes(q));
  }, [fields, search]);

  function handleDelete(field: CustomFieldDefinition) {
    if (!confirm(`Delete "${field.name}"? Every contact's value for this field will be removed too.`)) return;
    deleteField.mutate(field.id);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Custom Fields</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Extra fields tracked on every Contact, beyond the built-in ones -- shown on the Contact form.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          Add Custom Field
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Custom Fields" className="pl-8" />
      </div>

      <div className="bg-white border border-border rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary text-text-secondary text-xs">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Unique Key</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Required</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  {fields.length === 0 ? "No custom fields yet." : "No custom fields match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((f) => (
                <tr key={f.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{f.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs bg-surface-secondary text-text-secondary px-1.5 py-0.5 rounded">{keyFor(f.key)}</code>
                      <CopyButton value={keyFor(f.key)} label="Key copied" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">{TYPE_LABELS[f.type]}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{f.required ? "Yes" : "—"}</td>
                  <td className="px-4 py-2.5">
                    <Dropdown
                      trigger={
                        <button className="text-text-muted hover:text-text-primary p-1" aria-label="Actions">
                          <MoreVertical className="size-4" />
                        </button>
                      }
                      items={[
                        { label: "Edit", onClick: () => setEditing(f) },
                        { label: "Delete", danger: true, onClick: () => handleDelete(f) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomFieldFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(input) => createField.mutate(input, { onSuccess: () => setCreating(false) })}
        saving={createField.isPending}
      />
      <CustomFieldFormModal
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(input) => editing && updateField.mutate({ id: editing.id, ...input }, { onSuccess: () => setEditing(null) })}
        saving={updateField.isPending}
      />
    </section>
  );
}

function CustomFieldFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  initial?: CustomFieldDefinition;
  onClose: () => void;
  onSubmit: (input: { name: string; type: CustomFieldType; options?: string[]; required?: boolean }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<CustomFieldType>(initial?.type ?? "text");
  const [options, setOptions] = useState<string[]>(initial?.options ?? []);
  const [optionDraft, setOptionDraft] = useState("");
  const [required, setRequired] = useState(initial?.required ?? false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setType(initial?.type ?? "text");
    setOptions(initial?.options ?? []);
    setRequired(initial?.required ?? false);
    setOptionDraft("");
  }, [initial?.id, open]);

  function addOption() {
    const v = optionDraft.trim();
    if (!v || options.includes(v)) return;
    setOptions((prev) => [...prev, v]);
    setOptionDraft("");
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Custom Field" : "New Custom Field"} size="sm">
      <form
        className="space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit({ name: name.trim(), type, options: type === "dropdown" ? options : undefined, required });
        }}
      >
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Birthday" />
          {initial && <p className="text-xs text-text-muted mt-1">Key {keyFor(initial.key)} stays the same when you rename this.</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Field Type</label>
          <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "dropdown" && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Options</label>
            <div className="flex gap-1.5">
              <Input
                value={optionDraft}
                onChange={(e) => setOptionDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                placeholder="Type an option and press Enter"
              />
              <Button type="button" variant="secondary" onClick={addOption}>Add</Button>
            </div>
            {options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {options.map((opt) => (
                  <span key={opt} className="inline-flex items-center gap-1 bg-surface-secondary text-text-secondary text-xs px-2 py-1 rounded-full">
                    {opt}
                    <button type="button" onClick={() => setOptions((prev) => prev.filter((o) => o !== opt))} aria-label={`Remove ${opt}`}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4 rounded border-border text-brand-primary focus:ring-brand-primary" />
          Required
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>{initial ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
