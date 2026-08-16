export type AutomationNodeType =
  | "trigger"
  | "send_email"
  | "add_tag"
  | "remove_tag"
  | "move_pipeline_stage"
  | "condition"
  | "split"
  | "wait"
  | "create_task"
  | "create_note"
  | "create_opportunity"
  | "ai_prompt"
  | "update_contact_field"
  | "update_opportunity"
  | "assign_contact_to_user"
  | "send_notification"
  | "webhook"
  | "enroll_in_automation"
  | "set_event_date"
  | "end_workflow";

export type TriggerType =
  | "contact_created"
  | "tag_added"
  | "opportunity_stage_changed"
  | "opportunity_created"
  | "opportunity_won"
  | "opportunity_lost"
  | "task_completed"
  | "note_added"
  | "email_opened"
  | "webhook_received";

export type ConditionType = "email_opened" | "has_tag" | "opportunity_at_stage" | "days_since_entered" | "field_comparison";

export type ConditionCombinator = "AND" | "OR";

export type FieldComparisonOperator = "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";

/** Plain-string Contact columns a "field_comparison" condition or "update_contact_field" action may target. */
export const CONTACT_TEXT_FIELDS = [
  "firstName",
  "lastName",
  "company",
  "email",
  "phone",
  "website",
  "facebookUrl",
  "instagramUrl",
  "linkedinUrl",
  "twitterUrl",
  "address",
  "notes",
] as const;
export type ContactTextField = (typeof CONTACT_TEXT_FIELDS)[number];

export const CONTACT_FIELD_LABELS: Record<ContactTextField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  company: "Company",
  email: "Email",
  phone: "Phone",
  website: "Website",
  facebookUrl: "Facebook URL",
  instagramUrl: "Instagram URL",
  linkedinUrl: "LinkedIn URL",
  twitterUrl: "Twitter/X URL",
  address: "Address",
  notes: "Notes",
};

export type AssigneeMode = "none" | "single" | "round_robin";

/** One predicate inside a "condition" node. `id` is only used to key repeatable rule rows in the UI. */
export interface ConditionRule {
  id: string;
  conditionType: ConditionType;
  tag?: string;
  stageId?: string;
  days?: number;
  field?: ContactTextField;
  operator?: FieldComparisonOperator;
  value?: string;
}

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
