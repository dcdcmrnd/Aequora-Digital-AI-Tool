"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Lead } from "@/types";

export interface UseLeadsParams {
  searchId?: string;
  category?: string;
  location?: string;
  minRating?: number;
  minReviews?: number;
  /** true = has a website, false = no website, undefined = both */
  hasWebsite?: boolean;
  /** true = has an enriched email on file, false = no email found, undefined = both */
  hasEmail?: boolean;
  /** true = restrict to leads whose email passed the MX check */
  emailValid?: boolean;
  search?: string;
  sortBy?: "opportunityScore" | "reviewCount" | "rating" | "createdAt" | "email";
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ListLeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

function buildQueryString(params: UseLeadsParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

export function useLeads(params: UseLeadsParams = {}) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: () => apiFetch<ListLeadsResponse>(`/api/leads?${buildQueryString(params)}`),
  });
}

/** Bulk "Save as Contact" for a selection of leads — skips any that already have a matching contact by email. */
export function useBulkSaveLeadsAsContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadIds: string[]) =>
      apiFetch<{ created: number; skipped: number }>("/api/leads/bulk-save-as-contact", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
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

/** Bulk "Find People" — crawls each selected lead's website for decision-makers (capped lower than other bulk actions; each lead does several page fetches). */
export function useBulkFindPeople() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadIds: string[]) =>
      apiFetch<{ processed: number; peopleFound: number; failed: number }>("/api/leads/bulk-find-people", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      const failedNote = result.failed > 0 ? `, ${result.failed} failed` : "";
      toast.success(`Found ${result.peopleFound} ${result.peopleFound === 1 ? "person" : "people"} across ${result.processed} businesses${failedNote}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't find people.");
    },
  });
}

/** Re-checks the MX record for a selection of leads' already-enriched emails. */
export function useBulkVerifyLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadIds: string[]) =>
      apiFetch<{ checked: number; valid: number; invalid: number }>("/api/leads/bulk-verify", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Checked ${result.checked} email${result.checked === 1 ? "" : "s"} — ${result.valid} valid, ${result.invalid} invalid`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't verify emails.");
    },
  });
}
