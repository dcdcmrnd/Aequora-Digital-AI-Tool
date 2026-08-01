"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Automation, AutomationActionType, AutomationTriggerType } from "@/types";

export interface AutomationActionInput {
  actionType: AutomationActionType;
  config: Record<string, string>;
}

export interface AutomationInput {
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, string>;
  isActive: boolean;
  actions: AutomationActionInput[];
}

export interface AutomationUpdateInput extends Partial<AutomationInput> {
  id: string;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useAutomations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["automations"],
    queryFn: () => apiFetch<{ automations: Automation[] }>("/api/automations"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  }

  const createAutomation = useMutation({
    mutationFn: (input: AutomationInput) =>
      apiFetch<{ automation: Automation }>("/api/automations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Automation created");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to create automation")),
  });

  const updateAutomation = useMutation({
    mutationFn: ({ id, ...input }: AutomationUpdateInput) =>
      apiFetch<{ automation: Automation }>(`/api/automations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Automation updated");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update automation")),
  });

  const deleteAutomation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/automations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Automation deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete automation")),
  });

  return { ...query, automations: query.data?.automations, createAutomation, updateAutomation, deleteAutomation };
}
