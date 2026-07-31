"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Lead, LeadSearch } from "@/types";

export interface SearchInput {
  keyword: string;
  location: string;
  radiusMeters?: number;
}

export interface SearchResponse {
  leads: Lead[];
  resultsCount: number;
  searchId: string;
}

/** Covers both triggering a new search and reading search history. */
export function useLeadSearch() {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["lead-search-history"],
    queryFn: () => apiFetch<{ searches: LeadSearch[] }>("/api/leads/search-history"),
  });

  const search = useMutation({
    mutationFn: (input: SearchInput) =>
      apiFetch<SearchResponse>("/api/leads/search", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-search-history"] });
      toast.success(`Found ${result.resultsCount} businesses`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Search failed. Please try again.");
    },
  });

  return { history, search };
}
