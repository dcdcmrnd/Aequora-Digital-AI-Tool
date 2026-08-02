"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

import { ADD_STEP_OPTIONS } from "@/components/automation/PlaceholderNode";
import { Dropdown } from "@/components/ui/Dropdown";
import type { AutomationNodeType } from "@/types";

export function InsertableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const onInsert = (data as { onInsert?: (type: AutomationNodeType) => void } | undefined)?.onInsert;

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      {onInsert && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          >
            <Dropdown
              align="left"
              trigger={
                <button
                  type="button"
                  className="flex size-5 items-center justify-center rounded-full border border-border bg-white text-text-muted shadow-sm transition-colors hover:border-brand-primary hover:text-brand-primary"
                >
                  <Plus className="size-3" />
                </button>
              }
              items={ADD_STEP_OPTIONS.map((opt) => ({
                label: opt.label,
                icon: <opt.icon className="size-3.5" />,
                onClick: () => onInsert(opt.type),
              }))}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
