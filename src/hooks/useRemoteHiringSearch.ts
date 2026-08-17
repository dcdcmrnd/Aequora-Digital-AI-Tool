"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { RemoteHiringPost } from "@/types";

export interface RemoteHiringSearchInput {
  keyword: string;
  location?: string;
}

export interface RemoteHiringSearchResponse {
  searchId: string;
  jobsFound: number;
  companiesMatched: number;
  peopleFound: number;
  posts: RemoteHiringPost[];
}

/** Finds companies currently posting remote-hiring job ads and best-effort resolves a callable contact for each — can take close to a minute. */
export function useRemoteHiringSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RemoteHiringSearchInput) =>
      apiFetch<RemoteHiringSearchResponse>("/api/leads/remote-hiring-search", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        `Found ${result.jobsFound} job posts, matched ${result.companiesMatched} companies — ${result.peopleFound} people found`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Search failed. Please try again.");
    },
  });
}
