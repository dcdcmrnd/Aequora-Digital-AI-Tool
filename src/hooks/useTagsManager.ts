"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";

export interface TagWithCount {
  name: string;
  count: number;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Manages tags across all contacts -- distinct from useContactTags (just names, for autocomplete). */
export function useTagsManager() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["settings-tags"],
    queryFn: () => apiFetch<{ tags: TagWithCount[] }>("/api/settings/tags"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["settings-tags"] });
    queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }

  const rename = useMutation({
    mutationFn: (input: { from: string; to: string }) =>
      apiFetch<{ affected: number }>("/api/settings/tags", { method: "POST", body: JSON.stringify({ action: "rename", ...input }) }),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Renamed on ${result.affected} contact${result.affected === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to rename tag")),
  });

  const merge = useMutation({
    mutationFn: (input: { sources: string[]; target: string }) =>
      apiFetch<{ affected: number }>("/api/settings/tags", { method: "POST", body: JSON.stringify({ action: "merge", ...input }) }),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Merged across ${result.affected} contact${result.affected === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to merge tags")),
  });

  const remove = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ affected: number }>("/api/settings/tags", { method: "POST", body: JSON.stringify({ action: "delete", name }) }),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Removed from ${result.affected} contact${result.affected === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete tag")),
  });

  return { ...query, tags: query.data?.tags ?? [], rename, merge, remove };
}
