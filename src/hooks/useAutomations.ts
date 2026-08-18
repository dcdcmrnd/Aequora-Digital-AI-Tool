"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Automation, AutomationFlow, AutomationRun } from "@/types";

export interface AutomationInput {
  name: string;
  isActive: boolean;
  allowMultipleEntries: boolean;
  allowReentry: boolean;
  flow: AutomationFlow;
}

export interface AutomationUpdateInput extends Partial<AutomationInput> {
  id: string;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// Stable reference so consumers that put `counts` in a dependency array
// (e.g. AutomationCanvas's node-rebuild effect) don't re-run every render
// while the query is still loading -- a fresh `{}` literal each render would.
const EMPTY_COUNTS: Record<string, number> = {};

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

export function useAutomationRuns(automationId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ["automation-runs", automationId],
    queryFn: () => apiFetch<{ runs: AutomationRun[] }>(`/api/automations/${automationId}/runs`),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });

  return { ...query, runs: query.data?.runs };
}

/** How many contacts are currently sitting at each step — polled while the builder is open, powers the live badge on each node. */
export function useAutomationNodeCounts(automationId: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ["automation-node-counts", automationId],
    queryFn: () => apiFetch<{ counts: Record<string, number> }>(`/api/automations/${automationId}/node-counts`),
    enabled: enabled && !!automationId,
    refetchInterval: enabled && automationId ? 10_000 : false,
  });

  return { ...query, counts: query.data?.counts ?? EMPTY_COUNTS };
}

/** Contacts currently sitting at one specific node — fetched when the user clicks that node's count badge. */
export function useNodeContacts(automationId: string | undefined, nodeId: string | null) {
  const query = useQuery({
    queryKey: ["automation-node-contacts", automationId, nodeId],
    queryFn: () => apiFetch<{ runs: AutomationRun[] }>(`/api/automations/${automationId}/runs?nodeId=${nodeId}`),
    enabled: !!automationId && !!nodeId,
  });

  return { ...query, runs: query.data?.runs };
}

// Matches MAX_RUNS_PER_REQUEST in the bulk route -- a selection larger than
// this is split into sequential requests below rather than sent in one
// shot (which the server would reject outright) or silently truncated to
// the first chunk (which used to leave the rest of a large "select all"
// unprocessed with no indication anything was left behind).
const BULK_RUN_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** "Remove from Workflow" / "Push to Next Step" for a batch of selected contacts' runs -- transparently chunks a selection larger than one request can hold. */
export function useBulkRunAction(automationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runIds, action }: { runIds: string[]; action: "remove" | "advance" }) => {
      let count = 0;
      for (const batch of chunk(runIds, BULK_RUN_CHUNK_SIZE)) {
        const result = await apiFetch<{ success: true; count: number }>(`/api/automations/${automationId}/runs/bulk`, {
          method: "PATCH",
          body: JSON.stringify({ runIds: batch, action }),
        });
        count += result.count;
      }
      return { success: true as const, count };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["automation-node-counts", automationId] });
      queryClient.invalidateQueries({ queryKey: ["automation-node-contacts", automationId] });
      queryClient.invalidateQueries({ queryKey: ["automation-runs", automationId] });
      const verb = variables.action === "remove" ? "Removed from workflow" : "Pushed to next step";
      toast.success(`${verb} — ${data.count} contact${data.count === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Couldn't perform that action")),
  });
}
