"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { Lead } from "@/types";

export interface ManualLeadInput {
  name?: string;
  website?: string;
}

/** Audits one specific business by name/website, without a Google Places search first. */
export function useManualLeadAudit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManualLeadInput) =>
      apiFetch<{ lead: Lead }>("/api/leads/manual", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
