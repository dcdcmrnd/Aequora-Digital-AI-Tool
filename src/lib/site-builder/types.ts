// Phase 2 block set. BlockNode.style is deliberately a flat inline-style bag rather than the
// ResponsiveStyle (per-breakpoint) shape planned for Phase 4, so this content doesn't need
// migrating when that lands -- it just gets a `base` bucket wrapped around today's flat style.
export type BlockType = "section" | "text" | "button" | "image" | "spacer" | "video";

export interface BlockNode {
  id: string;
  type: BlockType;
  // Only "section" uses this today (Phase 2 scope: one level of nesting). Reordering within a
  // section's children works via drag same as root; dragging a block INTO/OUT OF a section is a
  // fast-follow, not this pass -- see SiteBuilderCanvas.tsx.
  children?: BlockNode[];
  props: Record<string, unknown>;
  style?: Record<string, string>;
}

export interface PageContent {
  blocks: BlockNode[];
}

export const EMPTY_PAGE_CONTENT: PageContent = { blocks: [] };
