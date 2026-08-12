"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { LeadPerson } from "@/types";

/** People found so far for one lead — backs the "People at this business" card on the lead detail page. */
export function useLeadPeople(leadId: string) {
  return useQuery({
    queryKey: ["lead-people", leadId],
    queryFn: () => apiFetch<{ people: LeadPerson[] }>(`/api/leads/${leadId}/people`),
  });
}

/** Crawls a lead's website (homepage + About/Team/Contact-style subpages) for named decision-makers. */
export function useLeadFindPeople(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<{ people: LeadPerson[] }>(`/api/leads/${leadId}/find-people`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-people", leadId] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success(data.people.length > 0 ? `Found ${data.people.length} ${data.people.length === 1 ? "person" : "people"}` : "No one found on their website");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't check this website.");
    },
  });
}

/**
 * Looks up a lead's business in a country's official company registry
 * (GB/US free, AU paid). A paid lookup that's run without acknowledgeCost
 * fails with a 402 whose message states the price — callers should show
 * that message as a confirm step, then retry with acknowledgeCost: true.
 */
export function useLeadFindPeopleFromRegistry(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ country, acknowledgeCost }: { country: "GB" | "US" | "AU"; acknowledgeCost?: boolean }) =>
      apiFetch<{ people: LeadPerson[] }>(`/api/leads/${leadId}/find-people-registry`, {
        method: "POST",
        body: JSON.stringify({ country, acknowledgeCost }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-people", leadId] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success(data.people.length > 0 ? `Found ${data.people.length} ${data.people.length === 1 ? "person" : "people"}` : "No directors found for this company");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Registry lookup failed.");
    },
  });
}
