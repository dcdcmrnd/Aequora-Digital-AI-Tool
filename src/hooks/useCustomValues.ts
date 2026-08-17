"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { CustomValue } from "@/types";

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useCustomValues() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["custom-values"],
    queryFn: () => apiFetch<{ values: CustomValue[] }>("/api/custom-values"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["custom-values"] });
  }

  const createValue = useMutation({
    mutationFn: (input: { name: string; value: string }) =>
      apiFetch<{ value: CustomValue }>("/api/custom-values", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Custom value created");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to create custom value")),
  });

  const updateValue = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; value?: string }) =>
      apiFetch<{ value: CustomValue }>(`/api/custom-values/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Custom value updated");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update custom value")),
  });

  const deleteValue = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/custom-values/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Custom value deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete custom value")),
  });

  return { ...query, values: query.data?.values ?? [], createValue, updateValue, deleteValue };
}
