"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { LeadStatus, SavedLead } from "@/types";

export interface SaveLeadInput {
  leadId: string;
  status?: LeadStatus;
  notes?: string;
  tags?: string[];
  followUpDate?: string;
}

export interface UpdateLeadInput {
  id: string;
  status?: LeadStatus;
  notes?: string | null;
  tags?: string[];
  followUpDate?: string | null;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useSavedLeads() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["saved-leads"],
    queryFn: () => apiFetch<{ savedLeads: SavedLead[] }>("/api/leads/saved"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["saved-leads"] });
  }

  const saveLead = useMutation({
    mutationFn: (input: SaveLeadInput) =>
      apiFetch<{ savedLead: SavedLead }>("/api/leads/saved", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Lead saved");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to save lead")),
  });

  const updateLead = useMutation({
    mutationFn: ({ id, ...input }: UpdateLeadInput) =>
      apiFetch<{ savedLead: SavedLead }>(`/api/leads/saved/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Lead updated");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update lead")),
  });

  const removeLead = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/leads/saved/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Lead removed");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to remove lead")),
  });

  return { ...query, savedLeads: query.data?.savedLeads, saveLead, updateLead, removeLead };
}
