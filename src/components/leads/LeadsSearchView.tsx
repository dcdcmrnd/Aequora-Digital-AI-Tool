"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import { LeadTable } from "@/components/leads/LeadTable";
import { SearchForm, type SearchFormValues } from "@/components/leads/SearchForm";
import { useLeads } from "@/hooks/useLeads";
import { useLeadSearch } from "@/hooks/useLeadSearch";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import type { Lead } from "@/types";

const PAGE_SIZE = 10;

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function LeadsSearchView() {
  const { search } = useLeadSearch();
  const { savedLeads, saveLead } = useSavedLeads();
  const [filters, setFilters] = useState<SearchFormValues | null>(null);
  const [page, setPage] = useState(1);

  const savedLeadIds = useMemo(() => new Set((savedLeads ?? []).map((saved) => saved.leadId)), [savedLeads]);

  const leads = useLeads(
    filters
      ? {
          category: toTitleCase(filters.keyword),
          minRating: filters.minRating,
          minReviews: filters.minReviews,
          hasWebsite: filters.hasWebsite === "any" ? undefined : filters.hasWebsite === "has",
          sortBy: filters.sortBy,
          sortDirection: "desc",
          page,
          pageSize: PAGE_SIZE,
        }
      : { page, pageSize: PAGE_SIZE },
  );

  function handleSubmit(values: SearchFormValues) {
    setFilters(values);
    setPage(1);
    search.mutate({ keyword: values.keyword, location: values.location, radiusMeters: values.radiusMeters });
  }

  function handleSave(lead: Lead) {
    if (savedLeadIds.has(lead.id)) return;
    saveLead.mutate({ leadId: lead.id });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-text-muted text-sm">Find local businesses and score them as prospecting opportunities.</p>
      </div>

      <SearchForm onSubmit={handleSubmit} isSearching={search.isPending} />

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
          onPageChange={setPage}
        />
      ) : (
        <p className="text-text-muted text-sm">Search for a business category and location to get started.</p>
      )}
    </div>
  );
}
