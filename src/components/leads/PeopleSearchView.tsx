"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { PeopleTable } from "@/components/leads/PeopleTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useBulkSavePeopleAsContacts } from "@/hooks/usePeople";
import { usePeopleSearch } from "@/hooks/usePeopleSearch";
import type { LeadPerson } from "@/types";

/**
 * Auto-discovers people by Position + Industry + Location: runs a business
 * search for the industry/location, then crawls the first ~10 results for
 * people matching Position — separate from FoundPeopleView, which only
 * shows people found manually via "Find People" on the Company tab.
 */
export function PeopleSearchView() {
  const [position, setPosition] = useState("");
  const [industry, setIndustry] = useState("");
  // Defaults to the whole US market rather than being required -- editable
  // down to a specific state/city if you want to narrow it, but left as-is
  // this searches nationwide.
  const [location, setLocation] = useState("United States");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | undefined>();

  const search = usePeopleSearch();
  const saveAsContacts = useBulkSavePeopleAsContacts();
  const people = search.data?.people ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!industry.trim()) return;
    setSelectedIds(new Set());
    search.mutate({
      position: position.trim() || undefined,
      industry: industry.trim(),
      location: location.trim() || undefined,
    });
  }

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

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-text-secondary mb-1 block text-xs font-medium">Position (optional)</label>
          <Input
            placeholder="e.g. Operations Manager"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-52"
          />
        </div>
        <div>
          <label className="text-text-secondary mb-1 block text-xs font-medium">Industry</label>
          <Input
            placeholder="e.g. Construction"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-52"
          />
        </div>
        <div>
          <label className="text-text-secondary mb-1 block text-xs font-medium">Location (optional)</label>
          <Input
            placeholder="e.g. Texas, or a specific city"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-52"
          />
        </div>
        <Button type="submit" loading={search.isPending} disabled={!industry.trim()}>
          <Search className="size-3.5" />
          Search
        </Button>
      </form>

      {search.isPending && (
        <p className="text-text-muted text-sm">
          Searching businesses and crawling the first ones found for people — this can take up to a minute.
        </p>
      )}

      {search.isError && <p className="text-danger text-sm">That search failed. Please try again.</p>}

      {search.data && (
        <>
          <p className="text-text-muted text-sm">
            Found {search.data.companiesFound} businesses, crawled the first {search.data.companiesCrawled} —{" "}
            {people.length} {people.length === 1 ? "person" : "people"} found.
          </p>

          {selectedIds.size > 0 && (
            <div className="border-border bg-surface-secondary flex items-center gap-3 rounded-btn border px-3 py-2 text-sm">
              <span>{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" onClick={handleBulkSaveAsContact} disabled={saveAsContacts.isPending}>
                Save as Contact
              </Button>
            </div>
          )}

          <PeopleTable
            data={people}
            page={1}
            pageSize={Math.max(people.length, 1)}
            total={people.length}
            onPageChange={() => {}}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onSaveAsContact={handleSaveAsContact}
            savingId={savingId}
          />
        </>
      )}

      {!search.data && !search.isPending && (
        <p className="text-text-muted text-xs">
          Searches for businesses matching Industry (nationwide across the US by default, or narrow it with
          Location), then automatically crawls the first ~10 results&apos; websites for people — matching Position if
          given, otherwise standard decision-maker titles (Owner, Founder, Director, etc.). Results here stay
          separate from the Found People tab.
        </p>
      )}
    </div>
  );
}
