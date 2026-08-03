"use client";

import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";

import { BulkActionsBar } from "@/components/contacts/BulkActionsBar";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ImportContactsModal } from "@/components/contacts/ImportContactsModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useContacts } from "@/hooks/useContacts";
import { usePermission } from "@/hooks/usePermission";

export function ContactsListView() {
  const { contacts, isLoading } = useContacts();
  const canManage = usePermission("contacts.manage");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((c) => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((c) => c.id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-text-muted text-sm">A shared list of business contacts for the whole team.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload className="size-4" />
              Import
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add Contact
            </Button>
          </div>
        )}
      </div>

      <Input
        placeholder="Search by name, company, email, or tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {canManage && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          onClear={() => setSelectedIds(new Set())}
          onDone={() => setSelectedIds(new Set())}
        />
      )}

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : filtered.length > 0 ? (
        <ContactsTable
          contacts={filtered}
          canManage={canManage}
          selectedIds={selectedIds}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
        />
      ) : (
        <p className="text-text-muted text-sm">
          {search ? `No contacts match "${search}".` : "No contacts yet. Add one, or save a lead as a contact."}
        </p>
      )}

      {adding && <ContactFormModal open={adding} onClose={() => setAdding(false)} />}
      {importing && <ImportContactsModal open={importing} onClose={() => setImporting(false)} />}
    </div>
  );
}
