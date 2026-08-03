"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Lead } from "@/types";

/** Fetches a lead's website and scans it for a contact email and social profile links. */
export function useLeadEnrich(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<{ lead: Lead }>(`/api/leads/${leadId}/enrich`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      const found = [data.lead.enrichedEmail, data.lead.enrichedFacebookUrl, data.lead.enrichedInstagramUrl, data.lead.enrichedLinkedinUrl, data.lead.enrichedTwitterUrl].filter(Boolean).length;
      toast.success(found > 0 ? `Found ${found} detail${found === 1 ? "" : "s"} on their website` : "Nothing found on their website");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't check this website.");
    },
  });
}
