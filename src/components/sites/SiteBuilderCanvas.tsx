"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useSite, useSaveDraftContent } from "@/hooks/useSites";
import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import { parseContent } from "@/lib/site-builder/render";
import { duplicateBlock, findBlock, removeBlock, updateBlock, appendBlock } from "@/lib/site-builder/tree";
import type { BlockNode, BlockType, PageContent } from "@/lib/site-builder/types";
import type { Page } from "@/types";
import { BlockConfigPanel } from "./BlockConfigPanel";
import { BlockPickerPanel } from "./BlockPickerPanel";
import { CanvasBlockList } from "./CanvasBlockList";

const AUTOSAVE_DELAY_MS = 1500;

function createBlock(type: BlockType): BlockNode {
  const def = BLOCK_DEFINITIONS[type];
  return {
    id: crypto.randomUUID(),
    type,
    props: def.defaultProps(),
    style: def.defaultStyle?.(),
    children: def.canHaveChildren ? [] : undefined,
  };
}

export function SiteBuilderCanvas({ siteId, page }: { siteId: string; page: Page }) {
  const { site, publishPage } = useSite(siteId);
  const saveDraft = useSaveDraftContent(siteId, page.id);

  const [content, setContent] = useState<PageContent>(() => parseContent(page.draftContent));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // undefined = insert at the page root; a block id = insert inside that section.
  const [pickerTarget, setPickerTarget] = useState<string | undefined | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRender = useRef(true);

  // Debounced autosave: writes draftContent AUTOSAVE_DELAY_MS after the last edit. Publishing
  // (a separate explicit action, see the header button) is what actually makes changes public.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft.mutate(JSON.stringify(content), { onSuccess: () => setSaveState("saved") });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const selectedBlock = selectedId ? findBlock(content.blocks, selectedId) : undefined;

  function handlePickBlock(type: BlockType) {
    const newBlock = createBlock(type);
    setContent((prev) => ({ blocks: appendBlock(prev.blocks, newBlock, pickerTarget ?? undefined) }));
    setPickerTarget(null);
    setSelectedId(newBlock.id);
  }

  function handleSaveBlock(patch: Partial<Pick<BlockNode, "props" | "style">>) {
    if (!selectedId) return;
    setContent((prev) => ({ blocks: updateBlock(prev.blocks, selectedId, (b) => ({ ...b, ...patch })) }));
    setSelectedId(null);
  }

  function handleDeleteBlock(id: string) {
    setContent((prev) => ({ blocks: removeBlock(prev.blocks, id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function handleDuplicateBlock(id: string) {
    setContent((prev) => ({ blocks: duplicateBlock(prev.blocks, id) }));
    setSelectedId(null);
  }

  function handlePublish() {
    // Flush any pending autosave first so Publish never ships stale content.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveDraft.mutate(JSON.stringify(content), {
      onSuccess: () => {
        setSaveState("saved");
        publishPage.mutate(page.id);
      },
    });
  }

  const previewUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${site?.slug ?? ""}${page.isHomepage ? "" : `/${page.slug}`}`;

  return (
    <div className="flex h-[80vh] flex-col rounded-card border border-border overflow-hidden" onClick={() => setSelectedId(null)}>
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/sites/${siteId}`} className="text-text-secondary hover:text-text-primary" onClick={(e) => e.stopPropagation()}>
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="text-text-primary text-sm font-semibold">{page.title}</p>
            <p className="text-text-muted text-xs">
              {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Draft saved" : "Editing draft"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {page.status === "published" && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View live <ExternalLink className="size-3" />
            </a>
          )}
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setPickerTarget(undefined);
            }}
          >
            <Plus className="size-4" />
            Add Block
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handlePublish();
            }}
            loading={publishPage.isPending}
          >
            <UploadCloud className="size-4" />
            Publish
          </Button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ backgroundColor: "#eef1f5", backgroundImage: "radial-gradient(#d3dae3 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      >
        <div className="site-content mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-md" onClick={(e) => e.stopPropagation()}>
          <CanvasBlockList
            blocks={content.blocks}
            onChange={(blocks) => setContent({ blocks })}
            selectedId={selectedId}
            onSelect={setSelectedId}
            emptyHint='No blocks yet — click "Add Block" to start.'
          />
        </div>
      </div>

      {selectedBlock && (
        <div onClick={(e) => e.stopPropagation()}>
          <BlockConfigPanel
            block={selectedBlock}
            onClose={() => setSelectedId(null)}
            onSave={handleSaveBlock}
            onDelete={() => handleDeleteBlock(selectedBlock.id)}
            onDuplicate={() => handleDuplicateBlock(selectedBlock.id)}
            onAddInside={selectedBlock.type === "section" ? () => setPickerTarget(selectedBlock.id) : undefined}
          />
        </div>
      )}

      {pickerTarget !== null && (
        <div onClick={(e) => e.stopPropagation()}>
          <BlockPickerPanel onPick={handlePickBlock} onClose={() => setPickerTarget(null)} />
        </div>
      )}
    </div>
  );
}
