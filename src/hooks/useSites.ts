"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Page, Site } from "@/types";

export interface SiteInput {
  name: string;
  slug: string;
  contactId?: string;
}

export interface PageInput {
  title: string;
  slug: string;
  isHomepage?: boolean;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useSites() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["sites"],
    queryFn: () => apiFetch<{ sites: Site[] }>("/api/sites"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["sites"] });
  }

  const createSite = useMutation({
    mutationFn: (input: SiteInput) =>
      apiFetch<{ site: Site }>("/api/sites", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Site created");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to create site")),
  });

  const deleteSite = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/sites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Site deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete site")),
  });

  return { ...query, sites: query.data?.sites, createSite, deleteSite };
}

export function useSite(siteId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => apiFetch<{ site: Omit<Site, "pages"> & { pages: Page[] } }>(`/api/sites/${siteId}`),
    enabled: !!siteId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["site", siteId] });
    queryClient.invalidateQueries({ queryKey: ["sites"] });
  }

  const createPage = useMutation({
    mutationFn: (input: PageInput) =>
      apiFetch<{ page: Page }>(`/api/sites/${siteId}/pages`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("Page created");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to create page")),
  });

  const publishPage = useMutation({
    mutationFn: (pageId: string) =>
      apiFetch<{ page: Page }>(`/api/sites/${siteId}/pages/${pageId}`, {
        method: "PATCH",
        body: JSON.stringify({ publish: true }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Page published");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to publish page")),
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => apiFetch<void>(`/api/sites/${siteId}/pages/${pageId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Page deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete page")),
  });

  const updateThemeTokens = useMutation({
    mutationFn: (themeTokens: string) =>
      apiFetch<{ site: Site }>(`/api/sites/${siteId}`, { method: "PATCH", body: JSON.stringify({ themeTokens }) }),
    onSuccess: (data) => {
      queryClient.setQueryData<{ site: Omit<Site, "pages"> & { pages: Page[] } } | undefined>(["site", siteId], (prev) =>
        prev ? { site: { ...prev.site, themeTokens: data.site.themeTokens } } : prev,
      );
      toast.success("Design updated");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update design")),
  });

  return { ...query, site: query.data?.site, createPage, publishPage, deletePage, updateThemeTokens };
}

/** Silent autosave for the editor -- no toast, and patches the cached site directly instead of refetching, so typing never causes a network-round-trip flicker. */
export function useSaveDraftContent(siteId: string, pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draftContent: string) =>
      apiFetch<{ page: Page }>(`/api/sites/${siteId}/pages/${pageId}`, {
        method: "PATCH",
        body: JSON.stringify({ draftContent }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<{ site: Omit<Site, "pages"> & { pages: Page[] } } | undefined>(["site", siteId], (prev) =>
        prev ? { site: { ...prev.site, pages: prev.site.pages.map((p) => (p.id === pageId ? data.page : p)) } } : prev,
      );
    },
  });
}
