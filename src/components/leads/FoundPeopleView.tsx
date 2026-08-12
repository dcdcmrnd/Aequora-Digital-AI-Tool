"use client";

import { useMemo, useState } from "react";

import { PeopleTable } from "@/components/leads/PeopleTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useBulkSavePeopleAsContacts, usePeople } from "@/hooks/usePeople";
import type { LeadPerson } from "@/types";

const PAGE_SIZE = 25;

const HAS_EMAIL_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "has", label: "Has email" },
  { value: "none", label: "No email" },
] as const;

const CONFIDENCE_OPTIONS = [
  { value: "any", label: "Any confidence" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

const SOURCE_OPTIONS = [
  { value: "any", label: "Any source" },
  { value: "website_crawl", label: "Website" },
  { value: "registry_gb", label: "UK registry" },
  { value: "registry_us", label: "US registry" },
  { value: "registry_au", label: "AU registry" },
] as const;

/** People found manually via "Find People" on a business in the Company tab — excludes results from People Search (see PeopleSearchView). */
export function FoundPeopleView() {
  const [search, setSearch] = useState("");
  const [icpOnly, setIcpOnly] = useState(false);
  const [hasEmail, setHasEmail] = useState<string>("any");
  const [confidence, setConfidence] = useState<string>("any");
  const [source, setSource] = useState<string>("any");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | undefined>();

  const people = usePeople({
    foundManually: true,
    search: search || undefined,
    matchesIcpTitle: icpOnly ? true : undefined,
    hasEmail: hasEmail === "any" ? undefined : hasEmail === "has",
    confidence: confidence === "any" ? undefined : confidence,
    source: source === "any" ? undefined : source,
    page,
    pageSize: PAGE_SIZE,
  });
  const saveAsContacts = useBulkSavePeopleAsContacts();

  const selectedCount = selectedIds.size;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(idsOnPage: string[]) {
    setSelectedIds((prev) => {
      const allSelected = idsOnPage.length > 0 && idsOnPage.every((id) => prev.has(id));
      const next = new Set(prev);
      idsOnPage.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function handleSaveAsContact(person: LeadPerson) {
    setSavingId(person.id);
    saveAsContacts.mutate([person.id], { onSettled: () => setSavingId(undefined) });
  }

  function handleBulkSaveAsContact() {
    saveAsContacts.mutate(Array.from(selectedIds), { onSuccess: () => setSelectedIds(new Set()) });
  }

  const filterProps = useMemo(
    () => ({ search, icpOnly, hasEmail, confidence, source }),
    [search, icpOnly, hasEmail, confidence, source],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search by name, title, or company..."
          value={filterProps.search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <label className="text-text-secondary flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={icpOnly}
            onChange={(e) => {
              setIcpOnly(e.target.checked);
              setPage(1);
            }}
            className="text-brand-primary focus:ring-brand-primary size-4 rounded border-border"
          />
          On target title only
        </label>
        <Select value={hasEmail} onValueChange={(v) => { setHasEmail(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HAS_EMAIL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={confidence} onValueChange={(v) => { setConfidence(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONFIDENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCount > 0 && (
        <div className="border-border bg-surface-secondary flex items-center gap-3 rounded-btn border px-3 py-2 text-sm">
          <span>{selectedCount} selected</span>
          <Button size="sm" variant="outline" onClick={handleBulkSaveAsContact} disabled={saveAsContacts.isPending}>
            Save as Contact
          </Button>
        </div>
      )}

      {people.isError && <p className="text-danger text-sm">Couldn&apos;t load people. Please try again.</p>}

      {people.isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : people.data ? (
        <PeopleTable
          data={people.data.people}
          page={people.data.page}
          pageSize={people.data.pageSize}
          total={people.data.total}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onSaveAsContact={handleSaveAsContact}
          savingId={savingId}
        />
      ) : null}

      <p className="text-text-muted text-xs">
        People are found by crawling a business&apos;s website or looking it up in a country registry — use &quot;Find
        People&quot; on a business in the Company tab, or select businesses there and run it in bulk.
      </p>
    </div>
  );
}
