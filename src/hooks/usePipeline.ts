"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Pipeline } from "@/types";

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function usePipeline() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => apiFetch<{ pipeline: Pipeline }>("/api/pipeline"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
  }

  const addStage = useMutation({
    mutationFn: (input: { pipelineId: string; name: string }) =>
      apiFetch("/api/pipeline/stages", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Stage added");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to add stage")),
  });

  const renameStage = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/pipeline/stages/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to rename stage")),
  });

  const reorderStage = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      apiFetch(`/api/pipeline/stages/${id}`, { method: "PATCH", body: JSON.stringify({ order }) }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to reorder stage")),
  });

  const deleteStage = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/pipeline/stages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Stage removed");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to remove stage")),
  });

  return { ...query, pipeline: query.data?.pipeline, addStage, renameStage, reorderStage, deleteStage };
}
