"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Lead } from "@/types";

/** Re-runs (or reuses a cached) website audit for a single lead. */
export function useLeadAudit(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<{ lead: Lead }>(`/api/leads/${leadId}/audit`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Audit complete");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Audit failed. Please try again.");
    },
  });
}
