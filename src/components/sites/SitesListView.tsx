"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSites } from "@/hooks/useSites";
import { usePermission } from "@/hooks/usePermission";
import type { Site } from "@/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SITE_STATUS_VARIANT: Record<Site["status"], "success" | "muted" | "warning"> = {
  published: "success",
  draft: "muted",
  archived: "warning",
};

export function SitesListView() {
  const { sites, isLoading, deleteSite } = useSites();
  const canManage = usePermission("sites.manage");
  const [createOpen, setCreateOpen] = useState(false);

  function handleDelete(site: Site) {
    if (!confirm(`Delete site "${site.name}"? This deletes all of its pages too.`)) return;
    deleteSite.mutate(site.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Websites</h1>
          <p className="text-text-muted text-sm">Build and publish client websites.</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Site
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : sites && sites.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sites.map((site) => (
            <div key={site.id} className="rounded-card border border-border bg-white p-4 flex items-center gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Globe className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/sites/${site.id}`} className="text-text-primary font-medium hover:underline">
                  {site.name}
                </Link>
                <p className="text-text-muted text-xs mt-0.5">
                  /p/{site.slug} · {site.pages?.length ?? 0} page{site.pages?.length === 1 ? "" : "s"}
                </p>
              </div>
              <Badge variant={SITE_STATUS_VARIANT[site.status]}>{site.status}</Badge>
              {canManage && (
                <button onClick={() => handleDelete(site)} className="text-text-muted hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm">No websites yet. {canManage && "Create one to get started."}</p>
      )}

      {createOpen && <CreateSiteModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateSiteModal({ onClose }: { onClose: () => void }) {
  const { createSite } = useSites();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit() {
    if (!name.trim() || !slug.trim()) return;
    createSite.mutate(
      { name: name.trim(), slug: slug.trim() },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open onClose={onClose} title="New Site">
      <div className="space-y-4 p-6">
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Site name</span>
          <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Acme Corp — Marketing Site" autoFocus />
        </label>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">URL slug</span>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="acme-corp"
          />
          <span className="text-text-muted block text-xs">Preview URL: /p/{slug || "..."}</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createSite.isPending} disabled={!name.trim() || !slug.trim()}>
            Create Site
          </Button>
        </div>
      </div>
    </Modal>
  );
}
