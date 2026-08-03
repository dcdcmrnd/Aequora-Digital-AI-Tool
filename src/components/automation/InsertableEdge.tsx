"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

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
  const onOpenPicker = (data as { onOpenPicker?: () => void } | undefined)?.onOpenPicker;

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      {onOpenPicker && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          >
            <button
              type="button"
              onClick={onOpenPicker}
              className="flex size-5 items-center justify-center rounded-full border border-border bg-white text-text-muted shadow-sm transition-colors hover:border-brand-primary hover:text-brand-primary"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
