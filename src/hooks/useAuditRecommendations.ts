"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { LeadAudit } from "@/types";

/** Generates (or regenerates) AI recommendations for a lead's audit. */
export function useAuditRecommendations(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<{ audit: LeadAudit }>(`/api/leads/${leadId}/recommendations`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Recommendations ready");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate recommendations.");
    },
  });
}
