import {
  Bell,
  Briefcase,
  CalendarClock,
  CheckSquare,
  Clock,
  GitBranch,
  Mail,
  Octagon,
  Pencil,
  StickyNote,
  Tag,
  TagsIcon,
  TrendingUp,
  UserPlus,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { formatWeekdayTime } from "@/lib/utils/schedule";

import type { AutomationNodeType } from "./types";

export type NodeCategory = "Contact & Pipeline" | "Records" | "Notifications & Webhooks" | "Flow Control";

export interface NodeDefinition {
  category: NodeCategory | null; // null for "trigger" — not a pickable step
  label: string;
  icon: LucideIcon;
  accent: string;
  defaultData: () => Record<string, unknown>;
  summarize: (data: Record<string, unknown>) => string;
  hasTargetHandle: boolean;
  hasSourceHandle: boolean;
  isBranching: boolean;
  canDuplicate: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  contact_created: "Contact Created",
  tag_added: "Tag Added to Contact",
  opportunity_stage_changed: "Opportunity Moved to Stage",
  opportunity_created: "Opportunity Created",
  opportunity_won: "Opportunity Won",
  opportunity_lost: "Opportunity Lost",
  task_completed: "Task Completed",
  note_added: "Note Added",
};

function summarizeCondition(data: Record<string, unknown>): string {
  const rules = data.rules as { conditionType?: string }[] | undefined;
  if (rules?.length) {
    return rules.length === 1 ? "1 condition" : `${rules.length} conditions (${(data.combinator as string) ?? "AND"})`;
  }
  const conditionType = data.conditionType as string | undefined;
  if (conditionType === "email_opened") return "Was the email opened?";
  if (conditionType === "has_tag") return data.tag ? `Contact has tag: "${data.tag}"?` : "Click to configure";
  if (conditionType === "opportunity_at_stage") return data.stageName ? `Opportunity at stage "${data.stageName}"?` : "Click to configure";
  if (conditionType === "days_since_entered") return data.days ? `${data.days} day(s) passed?` : "Click to configure";
  if (conditionType === "field_comparison") return data.field ? `Contact ${data.field} ${data.operator ?? "equals"} "${data.value ?? ""}"?` : "Click to configure";
  return "Click to configure";
}

export const NODE_DEFINITIONS: Record<AutomationNodeType, NodeDefinition> = {
  trigger: {
    category: null,
    label: "Trigger",
    icon: Zap,
    accent: "bg-brand-primary/10 text-brand-primary",
    defaultData: () => ({}),
    summarize: (data) => {
      const t = data.triggerType as string | undefined;
      if (!t) return "Click to configure";
      const suffix = t === "tag_added" && data.tag ? `: "${data.tag}"` : "";
      return `${TRIGGER_LABELS[t] ?? t}${suffix}`;
    },
    hasTargetHandle: false,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: false,
  },
  send_email: {
    category: "Notifications & Webhooks",
    label: "Send Email",
    icon: Mail,
    accent: "bg-brand-primary/10 text-brand-primary",
    defaultData: () => ({}),
    summarize: (data) => (data.subject as string) || "Click to configure",
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  add_tag: {
    category: "Contact & Pipeline",
    label: "Add Tag",
    icon: Tag,
    accent: "bg-emerald-50 text-emerald-600",
    defaultData: () => ({}),
    summarize: (data) => (data.tag ? `Tag: "${data.tag}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  remove_tag: {
    category: "Contact & Pipeline",
    label: "Remove Tag",
    icon: TagsIcon,
    accent: "bg-red-50 text-danger",
    defaultData: () => ({}),
    summarize: (data) => (data.tag ? `Remove tag: "${data.tag}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  move_pipeline_stage: {
    category: "Contact & Pipeline",
    label: "Move Pipeline Stage",
    icon: GitBranch,
    accent: "bg-blue-50 text-blue-600",
    defaultData: () => ({}),
    summarize: (data) => (data.stageName ? `Move to "${data.stageName}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  condition: {
    category: "Flow Control",
    label: "If / Else Condition",
    icon: GitBranch,
    accent: "bg-blue-50 text-blue-600",
    defaultData: () => ({}),
    summarize: summarizeCondition,
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: true,
    canDuplicate: false,
  },
  wait: {
    category: "Flow Control",
    label: "Wait",
    icon: Clock,
    accent: "bg-purple-50 text-purple-600",
    defaultData: () => ({ mode: "duration", amount: 1, unit: "hours" }),
    summarize: (data) => {
      if (data.mode === "condition") return "Until email is opened";
      if (data.mode === "schedule") {
        const [h, m] = ((data.time as string) ?? "09:00").split(":").map(Number);
        return formatWeekdayTime((data.dayOfWeek as number) ?? 1, h, m, (data.timezone as string) || "America/New_York");
      }
      if (data.mode === "event") {
        if (!data.amount) return "Click to configure";
        const direction = data.direction === "after" ? "after" : "before";
        return `${data.amount} ${data.unit ?? "days"} ${direction} event date`;
      }
      if (data.amount) return `${data.amount} ${data.unit ?? "hours"}`;
      return "Click to configure";
    },
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  create_task: {
    category: "Records",
    label: "Create Task",
    icon: CheckSquare,
    accent: "bg-teal-50 text-teal-600",
    defaultData: () => ({ priority: "medium", assigneeMode: "none" }),
    summarize: (data) => (data.title ? `Create task: "${data.title}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  create_note: {
    category: "Records",
    label: "Create Note",
    icon: StickyNote,
    accent: "bg-amber-50 text-amber-600",
    defaultData: () => ({}),
    summarize: (data) => (data.title ? `Create note: "${data.title}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  create_opportunity: {
    category: "Records",
    label: "Create Opportunity",
    icon: Briefcase,
    accent: "bg-blue-50 text-blue-600",
    defaultData: () => ({}),
    summarize: (data) => (data.name ? `Create opportunity: "${data.name}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  update_contact_field: {
    category: "Contact & Pipeline",
    label: "Update Contact Field",
    icon: Pencil,
    accent: "bg-emerald-50 text-emerald-600",
    defaultData: () => ({}),
    summarize: (data) => (data.field ? `Set ${data.field}` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  update_opportunity: {
    category: "Contact & Pipeline",
    label: "Update Opportunity",
    icon: TrendingUp,
    accent: "bg-blue-50 text-blue-600",
    defaultData: () => ({}),
    summarize: (data) => {
      if (data.status) return `Mark ${data.status}`;
      if (data.value !== undefined && data.value !== "") return "Update value";
      return "Click to configure";
    },
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  assign_contact_to_user: {
    category: "Contact & Pipeline",
    label: "Assign to User",
    icon: UserPlus,
    accent: "bg-indigo-50 text-indigo-600",
    defaultData: () => ({ mode: "single" }),
    summarize: (data) => {
      if (data.mode === "round_robin") return "Round robin assign";
      return data.assigneeId ? "Assign to user" : "Click to configure";
    },
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  set_event_date: {
    category: "Contact & Pipeline",
    label: "Set Event Date",
    icon: CalendarClock,
    accent: "bg-indigo-50 text-indigo-600",
    defaultData: () => ({}),
    summarize: (data) => {
      const value = data.value as string | undefined;
      if (!value) return "Click to configure";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "Click to configure" : `Event date: ${date.toLocaleString()}`;
    },
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  send_notification: {
    category: "Notifications & Webhooks",
    label: "Send Internal Notification",
    icon: Bell,
    accent: "bg-orange-50 text-orange-600",
    defaultData: () => ({ recipientMode: "single" }),
    summarize: (data) => (data.title ? `Notify: "${data.title}"` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  webhook: {
    category: "Notifications & Webhooks",
    label: "Webhook",
    icon: Webhook,
    accent: "bg-slate-100 text-slate-600",
    defaultData: () => ({ extraFields: [] }),
    summarize: (data) => (data.url ? `POST ${data.url}` : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  enroll_in_automation: {
    category: "Flow Control",
    label: "Enroll in Another Automation",
    icon: Workflow,
    accent: "bg-purple-50 text-purple-600",
    defaultData: () => ({}),
    summarize: (data) => (data.automationId ? "Enroll in another workflow" : "Click to configure"),
    hasTargetHandle: true,
    hasSourceHandle: true,
    isBranching: false,
    canDuplicate: true,
  },
  end_workflow: {
    category: "Flow Control",
    label: "End Workflow",
    icon: Octagon,
    accent: "bg-red-50 text-danger",
    defaultData: () => ({}),
    summarize: () => "Ends the workflow here",
    hasTargetHandle: true,
    hasSourceHandle: false,
    isBranching: false,
    canDuplicate: false,
  },
};

/** Every step type a user can add via the "+ Add Step" picker, grouped by category. */
export const PICKABLE_NODE_TYPES: { type: AutomationNodeType; category: NodeCategory }[] = (
  Object.entries(NODE_DEFINITIONS) as [AutomationNodeType, NodeDefinition][]
)
  .filter(([, def]) => def.category !== null)
  .map(([type, def]) => ({ type, category: def.category as NodeCategory }));

export const NODE_CATEGORIES: NodeCategory[] = ["Contact & Pipeline", "Records", "Notifications & Webhooks", "Flow Control"];
