"use client";

import { useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { BlockPreview } from "@/components/site-blocks/BlockRenderer";
import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import type { BlockNode } from "@/lib/site-builder/types";
import { cn } from "@/lib/utils";
import { EditableTextBlock } from "./EditableTextBlock";
import { EditableButtonBlock } from "./EditableButtonBlock";
import { EditableImageBlock } from "./EditableImageBlock";
import { EditableVideoBlock } from "./EditableVideoBlock";
import { EditableSpacerBlock } from "./EditableSpacerBlock";

interface SortableBlockItemProps {
  block: BlockNode;
  selected: boolean;
  onSelect: () => void;
  /** Exits edit mode without selecting a different block -- e.g. clicking away from an inline text editor. */
  onDeselect: () => void;
  /** Patches this block's own `props` in place -- used by the inline Editable*Block components (content edits), not the side config panel (style only, see BlockConfigPanel.tsx). */
  onChangeProps: (props: Record<string, unknown>) => void;
  /** For container blocks only: the nested CanvasBlockList rendering its children. */
  children?: ReactNode;
}

// Container blocks (canHaveChildren: section/columns/column) deliberately do NOT render via
// BlockPreview here -- that would use the plain (non-interactive) child rendering from
// site-blocks/BlockRenderer.tsx. Instead the container's own style is applied to a plain
// wrapper, and its children are rendered interactively via the nested CanvasBlockList passed in
// as `children`. Leaf types render via one of the Editable*Block components, which fall back to
// the exact same static site-blocks/* component when not selected -- so a block never looks
// different between "not editing" and "published" except while actively selected.
export function SortableBlockItem({ block, selected, onSelect, onDeselect, onChangeProps, children }: SortableBlockItemProps) {
  const def = BLOCK_DEFINITIONS[block.type];
  const Icon = def.icon;

  // Editing (as opposed to merely "selected") only applies to leaf types with an inline
  // interaction of their own -- containers use the side BlockConfigPanel for style instead.
  const isEditableLeaf = !def.canHaveChildren;
  const editing = selected && isEditableLeaf;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: editing });

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

  const showChrome = (selected || hovered) && !editing;

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
          "relative rounded-md border-2 transition-colors",
          editing ? "cursor-text" : "cursor-pointer",
          selected && !editing ? "border-brand-primary" : hovered && !editing ? "border-brand-primary/30" : "border-transparent",
        )}
      >
        {!editing && (
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
        )}

        {def.canHaveChildren ? (
          // The dashed border/tint below is editor-only chrome (a className, never part of
          // block.style, so never published) -- without it, a container with no background of
          // its own is otherwise completely invisible while editing, which reads as broken.
          <div style={block.style} className="min-h-[72px] rounded-md border border-dashed border-gray-300 bg-gray-50/60">
            {children}
          </div>
        ) : block.type === "text" ? (
          <EditableTextBlock block={block} editing={editing} onChange={(html) => onChangeProps({ ...block.props, html })} onDone={onDeselect} />
        ) : block.type === "button" ? (
          <EditableButtonBlock block={block} editing={editing} onChange={(patch) => onChangeProps({ ...block.props, ...patch })} />
        ) : block.type === "image" ? (
          <EditableImageBlock block={block} editing={editing} onChange={(patch) => onChangeProps({ ...block.props, ...patch })} />
        ) : block.type === "video" ? (
          <EditableVideoBlock block={block} editing={editing} onChange={(url) => onChangeProps({ ...block.props, url })} />
        ) : block.type === "spacer" ? (
          <EditableSpacerBlock block={block} editing={editing} onChange={(height) => onChangeProps({ ...block.props, height })} />
        ) : (
          <BlockPreview block={block} />
        )}
      </div>
    </div>
  );
}
