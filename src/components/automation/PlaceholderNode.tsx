"use client";

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";

export function PlaceholderNode({ data }: NodeProps) {
  const onOpenPicker = data.onOpenPicker as () => void;

  return (
    <div className="flex w-56 justify-center">
      <Handle type="target" position={Position.Top} className="!bg-border !size-2" />
      <button
        type="button"
        onClick={onOpenPicker}
        className="border-border text-text-muted hover:border-brand-primary hover:text-brand-primary flex items-center gap-1.5 rounded-full border border-dashed bg-white px-3 py-1.5 text-xs font-medium transition-colors"
      >
        <Plus className="size-3.5" />
        Add Step
      </button>
    </div>
  );
}
