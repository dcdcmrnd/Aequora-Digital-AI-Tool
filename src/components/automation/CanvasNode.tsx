"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS } from "@/lib/automation/nodeRegistry";
import type { AutomationNodeType } from "@/types";

export function CanvasNode({ type, data, selected }: NodeProps) {
  const nodeType = type as AutomationNodeType;
  const meta = NODE_DEFINITIONS[nodeType];
  const Icon = meta.icon;
  const summary = meta.summarize(data as Record<string, unknown>);
  const isUnconfigured = summary === "Click to configure";
  const contactCount = (data as Record<string, unknown>).__contactCount as number | undefined;
  const onShowContacts = (data as Record<string, unknown>).__onShowContacts as (() => void) | undefined;

  return (
    <div
      className={cn(
        "w-56 rounded-card border bg-white p-3 shadow-sm transition-colors",
        selected ? "border-brand-primary ring-1 ring-brand-primary" : "border-border",
        isUnconfigured && "border-dashed",
      )}
    >
      {meta.hasTargetHandle && <Handle type="target" position={Position.Top} className="!bg-border !size-2" />}

      <div className="flex items-center gap-2.5">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", meta.accent)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-semibold leading-tight">{meta.label}</p>
          <p className={cn("truncate text-xs", isUnconfigured ? "text-text-muted italic" : "text-text-secondary")}>
            {summary}
          </p>
        </div>
      </div>

      {!!contactCount && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowContacts?.();
          }}
          className="mt-2 flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-medium text-brand-primary hover:bg-brand-primary/20"
        >
          {contactCount} contact{contactCount === 1 ? "" : "s"}
        </button>
      )}

      {meta.isBranching ? (
        <>
          <div className="mt-2 flex justify-between px-1 text-[10px] font-medium">
            <span className="text-emerald-600">Yes</span>
            <span className="text-danger">No</span>
          </div>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "28%" }} className="!bg-emerald-500 !size-2" />
          <Handle type="source" position={Position.Bottom} id="no" style={{ left: "72%" }} className="!bg-danger !size-2" />
        </>
      ) : (
        meta.hasSourceHandle && <Handle type="source" position={Position.Bottom} className="!bg-border !size-2" />
      )}
    </div>
  );
}
