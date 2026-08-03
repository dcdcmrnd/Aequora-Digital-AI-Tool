"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";

import { BulkActionsBar } from "@/components/contacts/BulkActionsBar";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ImportContactsModal } from "@/components/contacts/ImportContactsModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useContacts } from "@/hooks/useContacts";
import { usePermission } from "@/hooks/usePermission";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function ContactsListView() {
  const { contacts, isLoading } = useContacts();
  const canManage = usePermission("contacts.manage");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Reset to page 1 whenever the visible set changes shape (new search, page size change).
  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

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
      const allSelected = paginated.length > 0 && paginated.every((c) => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(paginated.map((c) => c.id));
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
        <>
          <ContactsTable
            contacts={paginated}
            canManage={canManage}
            selectedIds={selectedIds}
            onToggle={toggleOne}
            onToggleAll={toggleAll}
          />

          <div className="flex items-center justify-between">
            <div className="text-text-muted flex items-center gap-2 text-sm">
              <span>
                Page {page} of {pageCount} · {filtered.length} contact{filtered.length === 1 ? "" : "s"}
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border-border rounded-btn border bg-white px-2 py-1 text-xs"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="size-3.5" /> Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount}>
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
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
