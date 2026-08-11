"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, ShieldCheck, Upload } from "lucide-react";

import { BulkActionsBar } from "@/components/contacts/BulkActionsBar";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { ContactsFilterBar } from "@/components/contacts/ContactsFilterBar";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ImportContactsModal } from "@/components/contacts/ImportContactsModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useContacts } from "@/hooks/useContacts";
import { useOpportunities } from "@/hooks/useOpportunities";
import { usePermission } from "@/hooks/usePermission";
import { usePipeline } from "@/hooks/usePipeline";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function ContactsListView() {
  const { contacts, isLoading, bulkVerify } = useContacts();
  const { opportunities } = useOpportunities();
  const { pipeline } = usePipeline();
  const canManage = usePermission("contacts.manage");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedCreatedById, setSelectedCreatedById] = useState<string | null>(null);

  const availableTags = useMemo(
    () => Array.from(new Set((contacts ?? []).flatMap((c) => c.tags))).sort(),
    [contacts],
  );
  const availableCompanies = useMemo(
    () => Array.from(new Set((contacts ?? []).map((c) => c.company).filter((c): c is string => !!c))).sort(),
    [contacts],
  );
  const creators = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts ?? []) {
      if (c.createdBy) map.set(c.createdBy.id, c.createdBy.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts]);
  const stageOptions = useMemo(
    () => (pipeline?.stages ? [...pipeline.stages].sort((a, b) => a.order - b.order) : []),
    [pipeline],
  );
  const openStagesByContact = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const opp of opportunities ?? []) {
      if (opp.status !== "open") continue;
      if (!map.has(opp.contactId)) map.set(opp.contactId, new Set());
      map.get(opp.contactId)!.add(opp.stageId);
    }
    return map;
  }, [opportunities]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function clearFilters() {
    setSelectedTags([]);
    setSelectedCompany(null);
    setSelectedStageId(null);
    setSelectedCreatedById(null);
  }

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.trim().toLowerCase();
    return contacts
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .filter((c) => selectedTags.length === 0 || selectedTags.some((t) => c.tags.includes(t)))
      .filter((c) => !selectedCompany || c.company === selectedCompany)
      .filter((c) => !selectedStageId || openStagesByContact.get(c.id)?.has(selectedStageId))
      .filter((c) => !selectedCreatedById || c.createdById === selectedCreatedById);
  }, [contacts, search, selectedTags, selectedCompany, selectedStageId, selectedCreatedById, openStagesByContact]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Reset to page 1 whenever the visible set changes shape (new search, filters, page size).
  useEffect(() => {
    setPage(1);
  }, [search, pageSize, selectedTags, selectedCompany, selectedStageId, selectedCreatedById]);

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
            <Button variant="secondary" onClick={() => bulkVerify.mutate()} loading={bulkVerify.isPending}>
              <ShieldCheck className="size-4" />
              Verify All Emails
            </Button>
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

      <ContactsFilterBar
        availableTags={availableTags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        availableCompanies={availableCompanies}
        selectedCompany={selectedCompany}
        onCompanyChange={setSelectedCompany}
        stages={stageOptions}
        selectedStageId={selectedStageId}
        onStageChange={setSelectedStageId}
        creators={creators}
        selectedCreatedById={selectedCreatedById}
        onCreatedByChange={setSelectedCreatedById}
        onClearAll={clearFilters}
      />

      {canManage && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          onClear={() => setSelectedIds(new Set())}
          onDone={() => setSelectedIds(new Set())}
          totalAvailable={filtered.length}
          onSelectAllAvailable={() => setSelectedIds(new Set(filtered.map((c) => c.id)))}
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
          {search || selectedTags.length > 0 || selectedCompany || selectedStageId || selectedCreatedById
            ? "No contacts match your search and filters."
            : "No contacts yet. Add one, or save a lead as a contact."}
        </p>
      )}

      {adding && <ContactFormModal open={adding} onClose={() => setAdding(false)} />}
      {importing && <ImportContactsModal open={importing} onClose={() => setImporting(false)} />}
    </div>
  );
}
