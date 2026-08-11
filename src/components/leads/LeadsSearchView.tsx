"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Search, UserPlus, X } from "lucide-react";

import type { LeadSortKey } from "@/components/leads/columns";
import { LeadTable } from "@/components/leads/LeadTable";
import { ManualAuditModal } from "@/components/leads/ManualAuditModal";
import { SearchForm, type SearchFormValues } from "@/components/leads/SearchForm";
import { Button } from "@/components/ui/Button";
import { useBulkSaveLeadsAsContacts, useLeads } from "@/hooks/useLeads";
import { useLeadSearch } from "@/hooks/useLeadSearch";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import { LEADS_PAGE_SIZE, toTitleCase } from "@/lib/leads/constants";
import type { Lead } from "@/types";

const PAGE_SIZE = LEADS_PAGE_SIZE;

type SortColumn = SearchFormValues["sortBy"] | "email";

function parseFiltersFromParams(params: URLSearchParams): SearchFormValues | null {
  const keyword = params.get("keyword");
  const location = params.get("location");
  // keyword === "" is a deliberate "browse all categories" search, distinct
  // from the param being entirely absent (this page was never searched).
  if (keyword === null || !location) return null;

  const minRatingRaw = params.get("minRating");
  const minReviewsRaw = params.get("minReviews");

  return {
    keyword,
    location,
    radiusMeters: Number(params.get("radius") ?? 8000),
    minRating: minRatingRaw ? Number(minRatingRaw) : undefined,
    minReviews: minReviewsRaw ? Number(minReviewsRaw) : undefined,
    hasWebsite: (params.get("hasWebsite") as SearchFormValues["hasWebsite"]) || "any",
    hasEmail: (params.get("hasEmail") as SearchFormValues["hasEmail"]) || "any",
    sortBy: (params.get("sortBy") as SearchFormValues["sortBy"]) || "opportunityScore",
  };
}

function buildSearchParams(
  filters: SearchFormValues,
  page: number,
  searchId: string | null,
  sortBy: SortColumn,
  sortDirection: "asc" | "desc",
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("keyword", filters.keyword);
  params.set("location", filters.location);
  params.set("radius", String(filters.radiusMeters));
  if (filters.minRating !== undefined) params.set("minRating", String(filters.minRating));
  if (filters.minReviews !== undefined) params.set("minReviews", String(filters.minReviews));
  params.set("hasWebsite", filters.hasWebsite);
  params.set("hasEmail", filters.hasEmail);
  params.set("sortBy", sortBy);
  params.set("sortDirection", sortDirection);
  params.set("page", String(page));
  if (searchId) params.set("searchId", searchId);
  return params;
}

export function LeadsSearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { search } = useLeadSearch();
  const { savedLeads, saveLead } = useSavedLeads();

  // Restored once on mount from the URL so "Back to search" (and reloads,
  // and sharing the link) return to the exact search that was running,
  // instead of resetting to a blank form — this state doesn't otherwise
  // survive navigating away to a lead's detail page and back.
  const [filters, setFilters] = useState<SearchFormValues | null>(() => parseFiltersFromParams(searchParams));
  const [page, setPage] = useState(() => Number(searchParams.get("page") ?? 1));
  // Ties the results table to exactly what the most recent search found
  // (via Lead.lastSearchId) instead of re-deriving "what matched" through
  // fuzzy category/location text matching against the whole shared table.
  const [searchId, setSearchId] = useState<string | null>(() => searchParams.get("searchId"));
  // Independent from the search form's own "Sort By" dropdown — clicking a
  // column header (Rating/Reviews/Email/Opportunity Score) updates this
  // directly and re-queries the DB, without re-running the Google search.
  const [sortBy, setSortBy] = useState<SortColumn>(
    () => (searchParams.get("sortBy") as SortColumn) || "opportunityScore",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    () => (searchParams.get("sortDirection") === "asc" ? "asc" : "desc"),
  );
  const [manualAuditOpen, setManualAuditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkSaveContacts = useBulkSaveLeadsAsContacts();
  // Searches the *entire* current result set (name or website, across every
  // page) rather than just the rows on screen — debounced so it doesn't fire
  // a query on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isFirstSearchChange = useRef(true);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (isFirstSearchChange.current) {
      isFirstSearchChange.current = false;
      return;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const savedLeadIds = useMemo(() => new Set((savedLeads ?? []).map((saved) => saved.leadId)), [savedLeads]);

  const leads = useLeads(
    filters
      ? {
          searchId: searchId ?? undefined,
          category: filters.keyword ? toTitleCase(filters.keyword) : undefined,
          location: filters.location,
          minRating: filters.minRating,
          minReviews: filters.minReviews,
          hasWebsite: filters.hasWebsite === "any" ? undefined : filters.hasWebsite === "has",
          hasEmail: filters.hasEmail === "any" ? undefined : filters.hasEmail !== "none",
          emailValid: filters.hasEmail === "valid" ? true : undefined,
          search: debouncedSearch || undefined,
          sortBy,
          sortDirection,
          page,
          pageSize: PAGE_SIZE,
        }
      : { page, pageSize: PAGE_SIZE, sortBy, sortDirection, search: debouncedSearch || undefined },
  );

  // Carried on each lead's detail link so its Previous/Next can browse this
  // exact same filtered/sorted list, and so "Back to search" lands back on
  // this exact search — deliberately the *same* keyword/location shape as
  // buildSearchParams/parseFiltersFromParams above (the /leads page's own
  // URL format), not the /api/leads query shape, so /leads can parse it back
  // into a real search instead of falling back to its blank state.
  const listParams = useMemo(
    () => (filters ? buildSearchParams(filters, page, searchId, sortBy, sortDirection).toString() : undefined),
    [filters, page, searchId, sortBy, sortDirection],
  );

  function updateUrl(nextFilters: SearchFormValues, nextPage: number, nextSearchId: string | null, nextSortBy: SortColumn, nextSortDirection: "asc" | "desc") {
    router.replace(`/leads?${buildSearchParams(nextFilters, nextPage, nextSearchId, nextSortBy, nextSortDirection)}`, { scroll: false });
  }

  function toggleLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage(idsOnPage: string[]) {
    setSelectedIds((prev) => {
      const allSelected = idsOnPage.length > 0 && idsOnPage.every((id) => prev.has(id));
      const next = new Set(prev);
      idsOnPage.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function handleBulkSaveContacts() {
    bulkSaveContacts.mutate(Array.from(selectedIds), { onSuccess: () => setSelectedIds(new Set()) });
  }

  function handleSubmit(values: SearchFormValues) {
    setFilters(values);
    setPage(1);
    setSearchId(null);
    setSelectedIds(new Set());
    setSortBy(values.sortBy);
    setSortDirection("desc");
    updateUrl(values, 1, null, values.sortBy, "desc");
    search.mutate(
      { keyword: values.keyword, location: values.location, radiusMeters: values.radiusMeters },
      {
        onSuccess: (result) => {
          setSearchId(result.searchId);
          updateUrl(values, 1, result.searchId, values.sortBy, "desc");
        },
      },
    );
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    if (filters) updateUrl(filters, nextPage, searchId, sortBy, sortDirection);
  }

  function handleSort(key: LeadSortKey) {
    const nextDirection: "asc" | "desc" =
      sortBy === key ? (sortDirection === "asc" ? "desc" : "asc") : key === "email" ? "asc" : "desc";
    setSortBy(key);
    setSortDirection(nextDirection);
    setPage(1);
    if (filters) updateUrl(filters, 1, searchId, key, nextDirection);
  }

  function handleSave(lead: Lead) {
    if (savedLeadIds.has(lead.id)) return;
    saveLead.mutate({ leadId: lead.id });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-text-muted text-sm">Find local businesses and score them as prospecting opportunities.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setManualAuditOpen(true)}>
          <Search className="size-3.5" />
          Audit a Specific Business
        </Button>
      </div>

      <SearchForm onSubmit={handleSubmit} isSearching={search.isPending} defaultValues={filters ?? undefined} />

      <ManualAuditModal open={manualAuditOpen} onClose={() => setManualAuditOpen(false)} />

      {selectedIds.size > 0 && (
        <div className="border-brand-primary bg-brand-primary/5 sticky top-0 z-10 flex items-center gap-3 rounded-card border px-4 py-2.5">
          <span className="text-text-primary text-sm font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleBulkSaveContacts} loading={bulkSaveContacts.isPending}>
              <UserPlus className="size-3.5" />
              Save as Contacts
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-text-muted hover:text-text-primary ml-1"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {leads.isError && (
        <div className="border-danger/40 rounded-card text-danger flex items-center gap-2 border bg-red-50 p-4 text-sm">
          <AlertCircle className="size-4" />
          Couldn&apos;t load leads. Please try again.
        </div>
      )}

      {leads.isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : leads.data ? (
        <LeadTable
          data={leads.data.leads}
          savedLeadIds={savedLeadIds}
          onSave={handleSave}
          page={leads.data.page}
          pageSize={leads.data.pageSize}
          total={leads.data.total}
          onPageChange={handlePageChange}
          searchedCategory={filters?.keyword ? toTitleCase(filters.keyword) : undefined}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
          listParams={listParams}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          selectedIds={selectedIds}
          onToggle={toggleLead}
          onToggleAll={toggleAllOnPage}
        />
      ) : (
        <p className="text-text-muted text-sm">Search for a business category and location to get started.</p>
      )}
    </div>
  );
}
