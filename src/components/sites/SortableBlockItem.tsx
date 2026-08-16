"use client";

import { useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { BlockPreview } from "@/components/site-blocks/BlockRenderer";
import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import type { BlockNode } from "@/lib/site-builder/types";
import { cn } from "@/lib/utils";

interface SortableBlockItemProps {
  block: BlockNode;
  selected: boolean;
  onSelect: () => void;
  /** For "section" blocks only: the nested CanvasBlockList rendering its children. */
  children?: ReactNode;
}

// Section-type blocks deliberately do NOT render via BlockPreview here -- that would use
// SectionBlock's plain (non-interactive) child rendering from site-blocks/BlockRenderer.tsx.
// Instead the section's own style is applied to a plain wrapper, and its children are rendered
// interactively via the nested CanvasBlockList passed in as `children`. Every other block type
// renders via BlockPreview directly, so leaf blocks are pixel-identical to the public page.
export function SortableBlockItem({ block, selected, onSelect, children }: SortableBlockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const def = BLOCK_DEFINITIONS[block.type];
  const Icon = def.icon;

  // Deliberately NOT CSS `:hover`/`group-hover`, and NOT onMouseEnter/Leave either -- both
  // apply to every ancestor of whatever the pointer is over (a child is geometrically inside
  // its parent's box too), so hovering a child block was also lighting up the parent Section's
  // chrome at the same time. onMouseOver/Out DO bubble, so calling stopPropagation() in the
  // innermost block's handler stops the browser from ever notifying an ancestor's listener --
  // exactly one block's chrome visible at a time, whichever is deepest under the pointer.
  const [hovered, setHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  const showChrome = selected || hovered;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onMouseOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onMouseOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        className={cn(
          "relative rounded-md border-2 transition-colors cursor-pointer",
          selected ? "border-brand-primary" : hovered ? "border-brand-primary/30" : "border-transparent",
        )}
      >
        <div
          className={cn(
            "absolute -top-7 left-0 z-10 flex items-center gap-1.5 rounded-full bg-brand-primary px-2.5 py-1 text-[10px] font-medium text-white shadow-sm transition-opacity",
            showChrome ? "opacity-100" : "opacity-0",
          )}
        >
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="size-3" />
          </button>
          <Icon className="size-3" />
          {def.label}
        </div>

        {block.type === "section" ? (
          // The dashed border/tint below is editor-only chrome (a className, never part of
          // block.style, so never published) -- without it, a section with no background of
          // its own is otherwise completely invisible while editing, which reads as broken.
          <div style={block.style} className="min-h-[72px] rounded-md border border-dashed border-gray-300 bg-gray-50/60">
            {children}
          </div>
        ) : (
          <BlockPreview block={block} />
        )}
      </div>
    </div>
  );
}
