"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { LeadPerson } from "@/types";

export interface PeopleSearchInput {
  position: string;
  industry: string;
  location: string;
}

export interface PeopleSearchResponse {
  searchId: string;
  companiesFound: number;
  companiesCrawled: number;
  people: LeadPerson[];
}

/** Auto-discovers people by Position + Industry + Location: searches for matching businesses, then crawls the first ~10 for people — can take close to a minute. */
export function usePeopleSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PeopleSearchInput) =>
      apiFetch<PeopleSearchResponse>("/api/leads/people-search", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        `Crawled ${result.companiesCrawled} of ${result.companiesFound} businesses found — ${result.people.length} people`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Search failed. Please try again.");
    },
  });
}
