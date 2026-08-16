"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LayoutTemplate, Plus } from "lucide-react";

import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import type { BlockNode } from "@/lib/site-builder/types";
import { SortableBlockItem } from "./SortableBlockItem";

interface CanvasBlockListProps {
  blocks: BlockNode[];
  /** This list's own container block id (undefined for the page root) -- used only to target the "+ Add block" button at the bottom of this specific list. */
  parentId?: string;
  /** Reorders/replaces just this list's own blocks -- the caller is responsible for splicing the result back into the right spot in the tree (root, or a specific container's children). */
  onChange: (blocks: BlockNode[]) => void;
  onChangeBlockProps: (id: string, props: Record<string, unknown>) => void;
  onAddBlock: (parentId: string | undefined) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  emptyHint: string;
}

// Reordering is scoped to whichever list a block already lives in (root, or one specific
// container's children) -- each CanvasBlockList instance is its own independent DndContext, same
// as one Kanban column's single-list reordering. Dragging a block INTO/OUT OF a container is a
// deliberate fast-follow, not this pass (see SiteBuilderCanvas.tsx for why).
export function CanvasBlockList({ blocks, parentId, onChange, onChangeBlockProps, onAddBlock, selectedId, onSelect, onDeselect, emptyHint }: CanvasBlockListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  const addButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAddBlock(parentId);
      }}
      className="text-text-muted hover:border-brand-primary hover:text-brand-primary flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 py-2.5 text-xs font-medium transition-colors"
    >
      <Plus className="size-3.5" />
      Add block
    </button>
  );

  if (blocks.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-text-muted flex flex-col items-center gap-2 rounded-md border border-dashed border-gray-300 py-10 text-center text-xs">
          <LayoutTemplate className="size-5 text-gray-300" />
          {emptyHint}
        </div>
        {addButton}
      </div>
    );
  }

  return (
    // pt-12 (not the smaller label-chip's own -top-7) leaves room for the taller floating
    // text-format toolbar (RichTextEditor.tsx, -top-10/-11) when the first block in this list is
    // being actively edited, so its toolbar doesn't get clipped by the scroll container's edge.
    <div className="space-y-3 pt-12">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => (
            <SortableBlockItem
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              onSelect={() => onSelect(block.id)}
              onDeselect={onDeselect}
              onChangeProps={(props) => onChangeBlockProps(block.id, props)}
            >
              {BLOCK_DEFINITIONS[block.type].canHaveChildren && (
                <CanvasBlockList
                  blocks={block.children ?? []}
                  parentId={block.id}
                  onChange={(children) => onChange(blocks.map((b) => (b.id === block.id ? { ...b, children } : b)))}
                  onChangeBlockProps={onChangeBlockProps}
                  onAddBlock={onAddBlock}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onDeselect={onDeselect}
                  emptyHint="Drop blocks here"
                />
              )}
            </SortableBlockItem>
          ))}
        </SortableContext>
      </DndContext>
      {addButton}
    </div>
  );
}
