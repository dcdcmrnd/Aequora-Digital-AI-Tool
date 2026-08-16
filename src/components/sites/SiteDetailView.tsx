"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Home, Pencil, Plus, Trash2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSite } from "@/hooks/useSites";
import { usePermission } from "@/hooks/usePermission";
import type { Page } from "@/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SiteDetailView({ siteId }: { siteId: string }) {
  const { site, isLoading, publishPage, deletePage } = useSite(siteId);
  const canManage = usePermission("sites.manage");
  const [createOpen, setCreateOpen] = useState(false);

  function previewUrl(page: Page): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/p/${site?.slug}${page.isHomepage ? "" : `/${page.slug}`}`;
  }

  function handleDelete(page: Page) {
    if (!confirm(`Delete page "${page.title}"?`)) return;
    deletePage.mutate(page.id);
  }

  if (isLoading || !site) {
    return <p className="text-text-muted text-sm">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sites" className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" />
          Back to Websites
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">{site.name}</h1>
          <p className="text-text-muted text-sm">/p/{site.slug}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Page
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {site.pages.length === 0 && <p className="text-text-muted text-sm">No pages yet.</p>}
        {site.pages.map((page) => (
          <div key={page.id} className="rounded-card border border-border bg-white p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <Link href={`/sites/${siteId}/pages/${page.id}/edit`} className="text-text-primary font-medium inline-flex items-center gap-1.5 hover:underline">
                {page.isHomepage && <Home className="text-text-muted size-3.5" />}
                {page.title}
              </Link>
              <p className="text-text-muted text-xs mt-0.5">/{page.isHomepage ? "" : page.slug}</p>
            </div>
            <Badge variant={page.status === "published" ? "success" : "muted"}>{page.status}</Badge>
            {page.status === "published" && (
              <a
                href={previewUrl(page)}
                target="_blank"
                rel="noreferrer"
                className="text-brand-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View <ExternalLink className="size-3" />
              </a>
            )}
            {canManage && (
              <div className="flex items-center gap-2">
                <Link href={`/sites/${siteId}/pages/${page.id}/edit`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={() => publishPage.mutate(page.id)} loading={publishPage.isPending}>
                  <UploadCloud className="size-3.5" />
                  Publish
                </Button>
                <button onClick={() => handleDelete(page)} className="text-text-muted hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {createOpen && <CreatePageModal siteId={siteId} hasHomepage={site.pages.some((p) => p.isHomepage)} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreatePageModal({
  siteId,
  hasHomepage,
  onClose,
}: {
  siteId: string;
  hasHomepage: boolean;
  onClose: () => void;
}) {
  const { createPage } = useSite(siteId);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [isHomepage, setIsHomepage] = useState(!hasHomepage);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit() {
    if (!title.trim() || !slug.trim()) return;
    createPage.mutate({ title: title.trim(), slug: slug.trim(), isHomepage }, { onSuccess: onClose });
  }

  return (
    <Modal open onClose={onClose} title="New Page">
      <div className="space-y-4 p-6">
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Page title</span>
          <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Home" autoFocus />
        </label>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">URL slug</span>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="about"
            disabled={isHomepage}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary select-none">
          <input
            type="checkbox"
            checked={isHomepage}
            onChange={(e) => setIsHomepage(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
          />
          Set as homepage {hasHomepage && "(replaces the current homepage)"}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createPage.isPending} disabled={!title.trim() || !slug.trim()}>
            Create Page
          </Button>
        </div>
      </div>
    </Modal>
  );
}
