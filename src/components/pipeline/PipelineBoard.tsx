"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import type { Opportunity, PipelineStage } from "@/types";

interface PipelineBoardProps {
  stages: PipelineStage[];
  opportunities: Opportunity[];
  canEdit: boolean;
  onStageChange: (opportunityId: string, stageId: string) => Promise<void>;
  onCardClick: (opportunity: Opportunity) => void;
}

export function PipelineBoard({ stages, opportunities, canEdit, onStageChange, onCardClick }: PipelineBoardProps) {
  const [activeOpportunity, setActiveOpportunity] = useState<Opportunity | null>(null);
  const [localOpportunities, setLocalOpportunities] = useState<Opportunity[]>(opportunities);

  if (opportunities !== localOpportunities && !activeOpportunity) {
    setLocalOpportunities(opportunities);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const byStage = stages.reduce(
    (acc, stage) => {
      acc[stage.id] = localOpportunities.filter((o) => o.stageId === stage.id);
      return acc;
    },
    {} as Record<string, Opportunity[]>,
  );

  function handleDragStart(event: DragStartEvent) {
    if (!canEdit) return;
    const opp = localOpportunities.find((o) => o.id === event.active.id);
    setActiveOpportunity(opp ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !canEdit) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const overStage = stages.find((s) => s.id === overId);
    if (overStage) {
      setLocalOpportunities((prev) => prev.map((o) => (o.id === activeId ? { ...o, stageId: overStage.id } : o)));
      return;
    }

    const overOpp = localOpportunities.find((o) => o.id === overId);
    if (overOpp && overOpp.id !== activeId) {
      setLocalOpportunities((prev) => prev.map((o) => (o.id === activeId ? { ...o, stageId: overOpp.stageId } : o)));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOpportunity(null);

    if (!over || !canEdit) {
      setLocalOpportunities(opportunities);
      return;
    }

    const dragged = localOpportunities.find((o) => o.id === active.id);
    if (!dragged) {
      setLocalOpportunities(opportunities);
      return;
    }

    const overStage = stages.find((s) => s.id === over.id);
    const overOpp = localOpportunities.find((o) => o.id === over.id);
    const targetStageId = overStage?.id ?? overOpp?.stageId ?? dragged.stageId;

    const originalStageId = opportunities.find((o) => o.id === active.id)?.stageId;
    if (targetStageId !== originalStageId) {
      await onStageChange(active.id as string, targetStageId);
    } else {
      setLocalOpportunities(opportunities);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            opportunities={byStage[stage.id] ?? []}
            canEdit={canEdit}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeOpportunity && <OpportunityCard opportunity={activeOpportunity} canEdit={false} onClick={() => {}} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  opportunities,
  canEdit,
  onCardClick,
}: {
  stage: PipelineStage;
  opportunities: Opportunity[];
  canEdit: boolean;
  onCardClick: (opportunity: Opportunity) => void;
}) {
  const total = opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <div className="flex w-64 flex-shrink-0 flex-col rounded-card bg-surface-secondary">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-xs font-semibold uppercase tracking-wide">{stage.name}</span>
          <span className="text-text-muted rounded-full bg-white px-1.5 py-0.5 text-xs font-medium">
            {opportunities.length}
          </span>
        </div>
        {total > 0 && <span className="text-text-muted text-[11px]">${total.toLocaleString()}</span>}
      </div>

      <SortableContext items={opportunities.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[40px] flex-1 space-y-2 overflow-y-auto px-2 pb-3">
          <DropZone id={stage.id} />
          {opportunities.map((opportunity) => (
            <SortableOpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              canEdit={canEdit}
              onClick={() => onCardClick(opportunity)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function DropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn("h-1 rounded transition-all", isOver && "bg-brand-primary/30 h-2")} />;
}

function SortableOpportunityCard({
  opportunity,
  canEdit,
  onClick,
}: {
  opportunity: Opportunity;
  canEdit: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
    disabled: !canEdit,
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(canEdit ? listeners : {})}>
      <OpportunityCard opportunity={opportunity} canEdit={canEdit} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

function OpportunityCard({
  opportunity,
  canEdit,
  onClick,
  isDragging,
}: {
  opportunity: Opportunity;
  canEdit: boolean;
  onClick: () => void;
  isDragging?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "border-border hover:border-brand-primary/30 select-none rounded-card border bg-white p-3 text-left transition-all hover:shadow-sm",
        isDragging && "rotate-1 shadow-lg",
        canEdit && "cursor-grab active:cursor-grabbing",
      )}
    >
      <p className="text-text-primary text-sm font-medium leading-snug">{opportunity.name}</p>
      {opportunity.contact && (
        <p className="text-text-muted mt-1 text-xs">
          {opportunity.contact.name}
          {opportunity.contact.company && ` · ${opportunity.contact.company}`}
        </p>
      )}
      {opportunity.value !== null && (
        <p className="text-brand-primary mt-1.5 text-xs font-semibold">${opportunity.value.toLocaleString()}</p>
      )}
    </div>
  );
}
