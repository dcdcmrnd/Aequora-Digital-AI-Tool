"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { CustomFieldDefinition, CustomFieldType } from "@/types";

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export interface CustomFieldInput {
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export function useCustomFields() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => apiFetch<{ fields: CustomFieldDefinition[] }>("/api/custom-fields"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
  }

  const createField = useMutation({
    mutationFn: (input: CustomFieldInput) =>
      apiFetch<{ field: CustomFieldDefinition }>("/api/custom-fields", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Custom field created");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to create custom field")),
  });

  const updateField = useMutation({
    mutationFn: ({ id, ...input }: Partial<CustomFieldInput> & { id: string }) =>
      apiFetch<{ field: CustomFieldDefinition }>(`/api/custom-fields/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Custom field updated");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update custom field")),
  });

  const deleteField = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/custom-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Custom field deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete custom field")),
  });

  return { ...query, fields: query.data?.fields ?? [], createField, updateField, deleteField };
}
