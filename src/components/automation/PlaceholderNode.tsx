"use client";

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch, Mail, Plus, Tag, TagsIcon, Clock } from "lucide-react";

import { Dropdown } from "@/components/ui/Dropdown";
import type { AutomationNodeType } from "@/types";

export const ADD_STEP_OPTIONS: { type: AutomationNodeType; label: string; icon: typeof Mail }[] = [
  { type: "send_email", label: "Send Email", icon: Mail },
  { type: "add_tag", label: "Add Tag", icon: Tag },
  { type: "remove_tag", label: "Remove Tag", icon: TagsIcon },
  { type: "move_pipeline_stage", label: "Move Pipeline Stage", icon: GitBranch },
  { type: "condition", label: "If / Else Condition", icon: GitBranch },
  { type: "wait", label: "Wait", icon: Clock },
];

export function PlaceholderNode({ data }: NodeProps) {
  const onPick = data.onPick as (type: AutomationNodeType) => void;

  return (
    <div className="flex w-56 justify-center">
      <Handle type="target" position={Position.Top} className="!bg-border !size-2" />
      <Dropdown
        align="left"
        trigger={
          <button
            type="button"
            className="border-border text-text-muted hover:border-brand-primary hover:text-brand-primary flex items-center gap-1.5 rounded-full border border-dashed bg-white px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Plus className="size-3.5" />
            Add Step
          </button>
        }
        items={ADD_STEP_OPTIONS.map((opt) => ({
          label: opt.label,
          icon: <opt.icon className="size-3.5" />,
          onClick: () => onPick(opt.type),
        }))}
      />
    </div>
  );
}
