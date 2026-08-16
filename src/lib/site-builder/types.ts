// BlockNode.style is deliberately a flat inline-style bag rather than the ResponsiveStyle
// (per-breakpoint) shape planned for a later pass, so this content doesn't need migrating when
// that lands -- it just gets a `base` bucket wrapped around today's flat style.
export type BlockType = "section" | "columns" | "column" | "text" | "button" | "image" | "spacer" | "video";

export interface BlockNode {
  id: string;
  type: BlockType;
  // "section"/"columns"/"column" are containers (BLOCK_DEFINITIONS[type].canHaveChildren).
  // Reordering within one container's children works via drag same as root; dragging a block
  // INTO/OUT OF a container is a fast-follow, not this pass -- see SiteBuilderCanvas.tsx.
  children?: BlockNode[];
  props: Record<string, unknown>;
  style?: Record<string, string>;
}

export interface PageContent {
  blocks: BlockNode[];
}

export const EMPTY_PAGE_CONTENT: PageContent = { blocks: [] };

/** Site.themeTokens JSON shape -- see designPresets.ts for the curated starting points. */
export interface ThemeTokens {
  preset: string;
  fonts: { heading: string; body: string };
  colors: { primary: string; secondary: string; background: string; text: string };
}
