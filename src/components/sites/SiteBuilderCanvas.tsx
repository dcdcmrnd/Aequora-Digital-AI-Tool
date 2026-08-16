"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, LayoutTemplate, Palette, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useSite, useSaveDraftContent } from "@/hooks/useSites";
import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import { parseContent } from "@/lib/site-builder/render";
import { googleFontsHref } from "@/lib/site-builder/designPresets";
import type { SectionTemplate } from "@/lib/site-builder/sectionTemplates";
import { parseThemeTokens, themeTokensToCssVars } from "@/lib/site-builder/theme";
import { duplicateBlock, findBlock, removeBlock, updateBlock, appendBlock } from "@/lib/site-builder/tree";
import type { BlockNode, BlockType, PageContent } from "@/lib/site-builder/types";
import type { Page } from "@/types";
import { BlockConfigPanel } from "./BlockConfigPanel";
import { BlockPickerPanel } from "./BlockPickerPanel";
import { CanvasBlockList } from "./CanvasBlockList";
import { SectionTemplatePicker } from "./SectionTemplatePicker";
import { SiteDesignPanel } from "./SiteDesignPanel";

const AUTOSAVE_DELAY_MS = 1500;

function createBlock(type: BlockType): BlockNode {
  const def = BLOCK_DEFINITIONS[type];
  return {
    id: crypto.randomUUID(),
    type,
    props: def.defaultProps(),
    style: def.defaultStyle?.(),
    // "column" is deliberately excluded from the atomic block picker (blockRegistry.ts) since a
    // bare column outside a "columns" parent renders oddly (flex-basis with no flex parent) --
    // so a manually-added "columns" block needs its two columns pre-populated here, or there'd
    // be no way to ever add one (only section templates build columns pre-filled otherwise).
    children: type === "columns" ? [createBlock("column"), createBlock("column")] : def.canHaveChildren ? [] : undefined,
  };
}

type Panel = { kind: "picker"; parentId: string | undefined } | { kind: "sectionGallery" } | { kind: "design" } | null;

export function SiteBuilderCanvas({ siteId, page }: { siteId: string; page: Page }) {
  const { site, publishPage } = useSite(siteId);
  const saveDraft = useSaveDraftContent(siteId, page.id);

  const [content, setContent] = useState<PageContent>(() => parseContent(page.draftContent));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
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
  const showConfigPanel = selectedBlock && BLOCK_DEFINITIONS[selectedBlock.type].canHaveChildren;

  function handlePickBlock(type: BlockType) {
    if (panel?.kind !== "picker") return;
    const newBlock = createBlock(type);
    setContent((prev) => ({ blocks: appendBlock(prev.blocks, newBlock, panel.parentId) }));
    setPanel(null);
    setSelectedId(newBlock.id);
  }

  function handlePickSectionTemplate(template: SectionTemplate) {
    const newSection = template.build();
    setContent((prev) => ({ blocks: appendBlock(prev.blocks, newSection, undefined) }));
    setPanel(null);
    setSelectedId(newSection.id);
  }

  function handleChangeBlockProps(id: string, props: Record<string, unknown>) {
    setContent((prev) => ({ blocks: updateBlock(prev.blocks, id, (b) => ({ ...b, props })) }));
  }

  function handleSaveBlockStyle(patch: Partial<Pick<BlockNode, "style">>) {
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
  const themeTokens = parseThemeTokens(site?.themeTokens);
  const themeVars = themeTokensToCssVars(themeTokens);

  return (
    <div className="flex h-[80vh] flex-col rounded-card border border-border overflow-hidden" onClick={() => setSelectedId(null)}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- dynamic curated font set, can't be a build-time next/font import */}
      <link rel="stylesheet" href={googleFontsHref()} />

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
              setPanel({ kind: "design" });
            }}
          >
            <Palette className="size-4" />
            Design
          </Button>
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setPanel({ kind: "sectionGallery" });
            }}
          >
            <LayoutTemplate className="size-4" />
            Add Section
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
        <div
          className="site-content mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-md"
          style={themeVars}
          onClick={(e) => e.stopPropagation()}
        >
          <CanvasBlockList
            blocks={content.blocks}
            onChange={(blocks) => setContent({ blocks })}
            onChangeBlockProps={handleChangeBlockProps}
            onAddBlock={(parentId) => setPanel({ kind: "picker", parentId })}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDeselect={() => setSelectedId(null)}
            emptyHint='No sections yet — click "Add Section" to start.'
          />
        </div>
      </div>

      {showConfigPanel && selectedBlock && (
        <div onClick={(e) => e.stopPropagation()}>
          <BlockConfigPanel
            block={selectedBlock}
            onClose={() => setSelectedId(null)}
            onSave={handleSaveBlockStyle}
            onDelete={() => handleDeleteBlock(selectedBlock.id)}
            onDuplicate={() => handleDuplicateBlock(selectedBlock.id)}
          />
        </div>
      )}

      {panel?.kind === "picker" && (
        <div onClick={(e) => e.stopPropagation()}>
          <BlockPickerPanel onPick={handlePickBlock} onClose={() => setPanel(null)} />
        </div>
      )}

      {panel?.kind === "sectionGallery" && (
        <div onClick={(e) => e.stopPropagation()}>
          <SectionTemplatePicker onPick={handlePickSectionTemplate} onClose={() => setPanel(null)} />
        </div>
      )}

      {panel?.kind === "design" && site && (
        <div onClick={(e) => e.stopPropagation()}>
          <SiteDesignPanel siteId={siteId} themeTokensJson={site.themeTokens} onClose={() => setPanel(null)} />
        </div>
      )}
    </div>
  );
}
