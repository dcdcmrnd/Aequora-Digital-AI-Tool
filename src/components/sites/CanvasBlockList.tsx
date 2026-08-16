"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { BlockNode } from "@/lib/site-builder/types";
import { SortableBlockItem } from "./SortableBlockItem";

interface CanvasBlockListProps {
  blocks: BlockNode[];
  /** Reorders/replaces just this list's own blocks -- the caller is responsible for splicing the result back into the right spot in the tree (root, or a specific section's children). */
  onChange: (blocks: BlockNode[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint: string;
}

// Reordering is scoped to whichever list a block already lives in (root, or one specific
// section's children) -- each CanvasBlockList instance is its own independent DndContext, same
// as one Kanban column's single-list reordering. Dragging a block INTO/OUT OF a section is a
// deliberate fast-follow, not this pass (see SiteBuilderCanvas.tsx for why).
export function CanvasBlockList({ blocks, onChange, selectedId, onSelect, emptyHint }: CanvasBlockListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  if (blocks.length === 0) {
    return <p className="text-text-muted rounded-md border border-dashed border-border py-6 text-center text-xs">{emptyHint}</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 pt-6">
          {blocks.map((block) => (
            <SortableBlockItem key={block.id} block={block} selected={block.id === selectedId} onSelect={() => onSelect(block.id)}>
              {block.type === "section" && (
                <CanvasBlockList
                  blocks={block.children ?? []}
                  onChange={(children) => onChange(blocks.map((b) => (b.id === block.id ? { ...b, children } : b)))}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  emptyHint="Drop blocks here"
                />
              )}
            </SortableBlockItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
