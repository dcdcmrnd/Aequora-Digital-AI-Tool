"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock, GitBranch, Mail, Tag, TagsIcon, Zap, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AutomationNodeType } from "@/types";

export const NODE_META: Record<AutomationNodeType, { icon: LucideIcon; label: string; accent: string }> = {
  trigger: { icon: Zap, label: "Trigger", accent: "bg-brand-primary/10 text-brand-primary" },
  send_email: { icon: Mail, label: "Send Email", accent: "bg-brand-primary/10 text-brand-primary" },
  add_tag: { icon: Tag, label: "Add Tag", accent: "bg-emerald-50 text-emerald-600" },
  remove_tag: { icon: TagsIcon, label: "Remove Tag", accent: "bg-red-50 text-danger" },
  move_pipeline_stage: { icon: GitBranch, label: "Move Stage", accent: "bg-blue-50 text-blue-600" },
  condition: { icon: GitBranch, label: "Condition", accent: "bg-blue-50 text-blue-600" },
  wait: { icon: Clock, label: "Wait", accent: "bg-purple-50 text-purple-600" },
};

const TRIGGER_LABELS: Record<string, string> = {
  contact_created: "Contact Created",
  tag_added: "Tag Added to Contact",
  opportunity_stage_changed: "Opportunity Moved to Stage",
};

function summarizeCondition(data: Record<string, unknown>): string {
  const conditionType = data.conditionType as string | undefined;
  if (conditionType === "email_opened") return "Was the email opened?";
  if (conditionType === "has_tag") return data.tag ? `Contact has tag: "${data.tag}"?` : "Click to configure";
  if (conditionType === "opportunity_at_stage") return data.stageName ? `Opportunity at stage "${data.stageName}"?` : "Click to configure";
  if (conditionType === "days_since_entered") return data.days ? `${data.days} day(s) passed?` : "Click to configure";
  return "Click to configure";
}

function summarize(type: AutomationNodeType, data: Record<string, unknown>): string {
  switch (type) {
    case "trigger": {
      const t = data.triggerType as string | undefined;
      if (!t) return "Click to configure";
      const suffix = t === "tag_added" && data.tag ? `: "${data.tag}"` : "";
      return `${TRIGGER_LABELS[t] ?? t}${suffix}`;
    }
    case "send_email":
      return (data.subject as string) || "Click to configure";
    case "add_tag":
      return data.tag ? `Tag: "${data.tag}"` : "Click to configure";
    case "remove_tag":
      return data.tag ? `Remove tag: "${data.tag}"` : "Click to configure";
    case "move_pipeline_stage":
      return data.stageName ? `Move to "${data.stageName}"` : "Click to configure";
    case "condition":
      return summarizeCondition(data);
    case "wait":
      if (data.mode === "condition") return "Until email is opened";
      if (data.amount) return `${data.amount} ${data.unit ?? "hours"}`;
      return "Click to configure";
    default:
      return "";
  }
}

export function CanvasNode({ type, data, selected }: NodeProps) {
  const nodeType = type as AutomationNodeType;
  const meta = NODE_META[nodeType];
  const Icon = meta.icon;
  const isTrigger = nodeType === "trigger";
  const isCondition = nodeType === "condition";
  const isUnconfigured = summarize(nodeType, data as Record<string, unknown>) === "Click to configure";

  return (
    <div
      className={cn(
        "w-56 rounded-card border bg-white p-3 shadow-sm transition-colors",
        selected ? "border-brand-primary ring-1 ring-brand-primary" : "border-border",
        isUnconfigured && "border-dashed",
      )}
    >
      {!isTrigger && <Handle type="target" position={Position.Top} className="!bg-border !size-2" />}

      <div className="flex items-center gap-2.5">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", meta.accent)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-semibold leading-tight">{meta.label}</p>
          <p className={cn("truncate text-xs", isUnconfigured ? "text-text-muted italic" : "text-text-secondary")}>
            {summarize(nodeType, data as Record<string, unknown>)}
          </p>
        </div>
      </div>

      {isCondition ? (
        <>
          <div className="mt-2 flex justify-between px-1 text-[10px] font-medium">
            <span className="text-emerald-600">Yes</span>
            <span className="text-danger">No</span>
          </div>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "28%" }} className="!bg-emerald-500 !size-2" />
          <Handle type="source" position={Position.Bottom} id="no" style={{ left: "72%" }} className="!bg-danger !size-2" />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-border !size-2" />
      )}
    </div>
  );
}
