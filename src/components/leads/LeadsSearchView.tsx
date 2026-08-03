"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function parseFiltersFromParams(params: URLSearchParams): SearchFormValues | null {
  const keyword = params.get("keyword");
  const location = params.get("location");
  if (!keyword || !location) return null;

  const minRatingRaw = params.get("minRating");
  const minReviewsRaw = params.get("minReviews");

  return {
    keyword,
    location,
    radiusMeters: Number(params.get("radius") ?? 8000),
    minRating: minRatingRaw ? Number(minRatingRaw) : undefined,
    minReviews: minReviewsRaw ? Number(minReviewsRaw) : undefined,
    hasWebsite: (params.get("hasWebsite") as SearchFormValues["hasWebsite"]) || "any",
    sortBy: (params.get("sortBy") as SearchFormValues["sortBy"]) || "opportunityScore",
  };
}

function buildSearchParams(filters: SearchFormValues, page: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set("keyword", filters.keyword);
  params.set("location", filters.location);
  params.set("radius", String(filters.radiusMeters));
  if (filters.minRating !== undefined) params.set("minRating", String(filters.minRating));
  if (filters.minReviews !== undefined) params.set("minReviews", String(filters.minReviews));
  params.set("hasWebsite", filters.hasWebsite);
  params.set("sortBy", filters.sortBy);
  params.set("page", String(page));
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

  function updateUrl(nextFilters: SearchFormValues, nextPage: number) {
    router.replace(`/leads?${buildSearchParams(nextFilters, nextPage)}`, { scroll: false });
  }

  function handleSubmit(values: SearchFormValues) {
    setFilters(values);
    setPage(1);
    updateUrl(values, 1);
    search.mutate({ keyword: values.keyword, location: values.location, radiusMeters: values.radiusMeters });
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    if (filters) updateUrl(filters, nextPage);
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

      <SearchForm onSubmit={handleSubmit} isSearching={search.isPending} defaultValues={filters ?? undefined} />

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
        />
      ) : (
        <p className="text-text-muted text-sm">Search for a business category and location to get started.</p>
      )}
    </div>
  );
}
