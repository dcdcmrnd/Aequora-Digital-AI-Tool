"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
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
