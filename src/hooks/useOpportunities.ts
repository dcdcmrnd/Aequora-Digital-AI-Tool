"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Opportunity, OpportunityStatus } from "@/types";

export interface OpportunityInput {
  name: string;
  value?: number;
  contactId: string;
  pipelineId: string;
  stageId: string;
  notes?: string;
}

export interface OpportunityUpdateInput {
  id: string;
  name?: string;
  value?: number | null;
  status?: OpportunityStatus;
  stageId?: string;
  notes?: string | null;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useOpportunities() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["opportunities"],
    queryFn: () => apiFetch<{ opportunities: Opportunity[] }>("/api/opportunities"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["opportunities"] });
  }

  const createOpportunity = useMutation({
    mutationFn: (input: OpportunityInput) =>
      apiFetch<{ opportunity: Opportunity }>("/api/opportunities", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity added");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to add opportunity")),
  });

  const updateOpportunity = useMutation({
    mutationFn: ({ id, ...input }: OpportunityUpdateInput) =>
      apiFetch<{ opportunity: Opportunity }>(`/api/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update opportunity")),
  });

  const deleteOpportunity = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/opportunities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete opportunity")),
  });

  return { ...query, opportunities: query.data?.opportunities, createOpportunity, updateOpportunity, deleteOpportunity };
}
