"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Copy, MoreVertical, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS } from "@/lib/automation/nodeRegistry";
import type { AutomationNodeType } from "@/types";

/**
 * Per-node "..." menu -- offers the GoHighLevel-style copy/delete choices
 * directly on the canvas node, not just inside the side config panel.
 * "Copy action" / "Copy all actions below" are hidden for nodes that can't
 * safely support them (trigger, condition, end_workflow -- see the handlers
 * in AutomationCanvas for why); "Delete action" (single) is hidden for
 * condition nodes specifically, since it can't safely preserve both branches.
 */
function NodeMenu({
  isBranching,
  canDuplicate,
  canDelete,
  onCopyNode,
  onCopySubtree,
  onDeleteNode,
  onDeleteSubtree,
}: {
  isBranching: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onCopyNode?: () => void;
  onCopySubtree?: () => void;
  onDeleteNode?: () => void;
  onDeleteSubtree?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!canDelete && !canDuplicate) return null;

  const items: { label: string; icon: typeof Copy; danger?: boolean; onClick: () => void }[] = [];
  if (canDuplicate) {
    items.push({ label: "Copy action", icon: Copy, onClick: () => onCopyNode?.() });
    items.push({ label: "Copy all actions below", icon: Copy, onClick: () => onCopySubtree?.() });
  }
  if (canDelete && !isBranching) {
    items.push({ label: "Delete action", icon: Trash2, danger: true, onClick: () => onDeleteNode?.() });
  }
  if (canDelete) {
    items.push({ label: "Delete all actions below", icon: Trash2, danger: true, onClick: () => onDeleteSubtree?.() });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="text-text-muted hover:text-text-primary hover:bg-surface-secondary flex size-6 shrink-0 items-center justify-center rounded"
      >
        <MoreVertical className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 min-w-[190px] rounded-card border border-border bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                item.danger ? "text-danger hover:bg-red-50" : "text-text-primary hover:bg-surface-secondary",
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CanvasNode({ type, data, selected }: NodeProps) {
  const nodeType = type as AutomationNodeType;
  const meta = NODE_DEFINITIONS[nodeType];
  const Icon = meta.icon;
  const summary = meta.summarize(data as Record<string, unknown>);
  const isUnconfigured = summary === "Click to configure";
  const d = data as Record<string, unknown>;
  const contactCount = d.__contactCount as number | undefined;
  const onShowContacts = d.__onShowContacts as (() => void) | undefined;
  const onCopyNode = d.__onCopyNode as (() => void) | undefined;
  const onCopySubtree = d.__onCopySubtree as (() => void) | undefined;
  const onDeleteNode = d.__onDeleteNode as (() => void) | undefined;
  const onDeleteSubtree = d.__onDeleteSubtree as (() => void) | undefined;

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
        <NodeMenu
          isBranching={meta.isBranching}
          canDuplicate={meta.canDuplicate}
          canDelete={nodeType !== "trigger"}
          onCopyNode={onCopyNode}
          onCopySubtree={onCopySubtree}
          onDeleteNode={onDeleteNode}
          onDeleteSubtree={onDeleteSubtree}
        />
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
            <span className="text-emerald-600">{meta.branchLabels?.first ?? "Yes"}</span>
            <span className="text-danger">{meta.branchLabels?.second ?? "No"}</span>
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
