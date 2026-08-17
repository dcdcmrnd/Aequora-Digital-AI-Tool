"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { ClipboardPaste, Plus } from "lucide-react";

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
  const edgeData = data as { onOpenPicker?: () => void; pasting?: boolean } | undefined;
  const onOpenPicker = edgeData?.onOpenPicker;
  const pasting = !!edgeData?.pasting;

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
              title={pasting ? "Paste here" : "Add a step"}
              className={
                pasting
                  ? "flex size-5 items-center justify-center rounded-full border border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm transition-colors hover:bg-brand-primary/20"
                  : "flex size-5 items-center justify-center rounded-full border border-border bg-white text-text-muted shadow-sm transition-colors hover:border-brand-primary hover:text-brand-primary"
              }
            >
              {pasting ? <ClipboardPaste className="size-3" /> : <Plus className="size-3" />}
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
