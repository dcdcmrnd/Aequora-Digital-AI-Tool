export type AutomationNodeType = "trigger" | "send_email" | "add_tag" | "remove_tag" | "move_pipeline_stage" | "condition" | "wait";

export type TriggerType = "contact_created" | "tag_added" | "opportunity_stage_changed";

export type ConditionType = "email_opened" | "has_tag" | "opportunity_at_stage" | "days_since_entered";

export type WaitUnit = "minutes" | "hours" | "days";

export interface AutomationNode {
  id: string;
  type: AutomationNodeType;
  position: { x: number; y: number };
  /** Shape depends on `type` — see NodeConfigPanel for the field set per type. */
  data: Record<string, unknown>;
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  /** Set on edges leaving a "condition" node: "yes" | "no". */
  sourceHandle?: string | null;
}

export interface AutomationFlow {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export const EMPTY_FLOW: AutomationFlow = { nodes: [], edges: [] };
