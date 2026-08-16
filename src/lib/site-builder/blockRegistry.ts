import { Columns as ColumnsIcon, Image as ImageIcon, LayoutPanelTop, MousePointerClick, MoveVertical, RectangleHorizontal, Type, Video, type LucideIcon } from "lucide-react";

import type { BlockType } from "./types";

export type BlockCategory = "Layout" | "Content" | "Media";

export interface BlockDefinition {
  category: BlockCategory;
  label: string;
  icon: LucideIcon;
  accent: string;
  canHaveChildren: boolean;
  defaultProps: () => Record<string, unknown>;
  defaultStyle?: () => Record<string, string>;
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  section: {
    category: "Layout",
    label: "Section",
    icon: LayoutPanelTop,
    accent: "bg-blue-50 text-blue-600",
    canHaveChildren: true,
    defaultProps: () => ({}),
    defaultStyle: () => ({ padding: "48px 24px" }),
  },
  columns: {
    category: "Layout",
    label: "Columns",
    icon: ColumnsIcon,
    accent: "bg-indigo-50 text-indigo-600",
    canHaveChildren: true,
    defaultProps: () => ({}),
  },
  column: {
    category: "Layout",
    label: "Column",
    icon: RectangleHorizontal,
    accent: "bg-indigo-50 text-indigo-600",
    canHaveChildren: true,
    // Created only as a "columns" block's children (via createColumnsBlock() in
    // sectionTemplates.ts) or by that block's own "Add Column" action -- not offered in the
    // atomic block picker directly, see PICKABLE_BLOCK_TYPES below.
    defaultProps: () => ({ widthPercent: 50 }),
  },
  text: {
    category: "Content",
    label: "Text",
    icon: Type,
    accent: "bg-slate-100 text-slate-600",
    canHaveChildren: false,
    defaultProps: () => ({ html: "<p>Edit this text</p>" }),
  },
  button: {
    category: "Content",
    label: "Button",
    icon: MousePointerClick,
    accent: "bg-emerald-50 text-emerald-600",
    canHaveChildren: false,
    defaultProps: () => ({ label: "Click here", href: "#" }),
  },
  image: {
    category: "Media",
    label: "Image",
    icon: ImageIcon,
    accent: "bg-purple-50 text-purple-600",
    canHaveChildren: false,
    defaultProps: () => ({ src: "", alt: "" }),
  },
  video: {
    category: "Media",
    label: "Video Embed",
    icon: Video,
    accent: "bg-rose-50 text-rose-600",
    canHaveChildren: false,
    defaultProps: () => ({ url: "" }),
  },
  spacer: {
    category: "Layout",
    label: "Spacer",
    icon: MoveVertical,
    accent: "bg-amber-50 text-amber-600",
    canHaveChildren: false,
    defaultProps: () => ({ height: "40px" }),
  },
};

export const BLOCK_CATEGORIES: BlockCategory[] = ["Layout", "Content", "Media"];

export const PICKABLE_BLOCK_TYPES: { type: BlockType; category: BlockCategory }[] = (
  Object.entries(BLOCK_DEFINITIONS) as [BlockType, BlockDefinition][]
)
  .filter(([type]) => type !== "column") // only ever created as a "columns" block's own child
  .map(([type, def]) => ({ type, category: def.category }));
