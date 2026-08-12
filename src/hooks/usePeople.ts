"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { LeadPerson } from "@/types";

export interface UsePeopleParams {
  search?: string;
  matchesIcpTitle?: boolean;
  hasEmail?: boolean;
  confidence?: string;
  source?: string;
  sortBy?: "createdAt" | "name";
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ListPeopleResponse {
  people: LeadPerson[];
  total: number;
  page: number;
  pageSize: number;
}

function buildQueryString(params: UsePeopleParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

export function usePeople(params: UsePeopleParams = {}) {
  return useQuery({
    queryKey: ["people", params],
    queryFn: () => apiFetch<ListPeopleResponse>(`/api/leads/people?${buildQueryString(params)}`),
  });
}

/** "Save as Contact" for a selection of found people — skips any that already have a matching contact by email. */
export function useBulkSavePeopleAsContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personIds: string[]) =>
      apiFetch<{ created: number; skipped: number }>("/api/leads/people/bulk-save-as-contact", {
        method: "POST",
        body: JSON.stringify({ personIds }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      const skippedNote = result.skipped > 0 ? `, ${result.skipped} already had a contact` : "";
      toast.success(`Saved ${result.created} contact${result.created === 1 ? "" : "s"}${skippedNote}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save contacts.");
    },
  });
}
