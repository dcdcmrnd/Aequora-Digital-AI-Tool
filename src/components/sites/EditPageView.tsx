"use client";

import { useSite } from "@/hooks/useSites";
import { SiteBuilderCanvas } from "./SiteBuilderCanvas";

export function EditPageView({ siteId, pageId }: { siteId: string; pageId: string }) {
  const { site, isLoading } = useSite(siteId);
  const page = site?.pages.find((p) => p.id === pageId);

  if (isLoading || !site) return <p className="text-text-muted text-sm">Loading...</p>;
  if (!page) return <p className="text-text-muted text-sm">Page not found.</p>;

  return <SiteBuilderCanvas siteId={siteId} page={page} />;
}
