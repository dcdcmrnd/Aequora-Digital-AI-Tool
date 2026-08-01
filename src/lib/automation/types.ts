export type TriggerType = "contact_created" | "tag_added" | "opportunity_stage_changed";
export type ActionType = "send_email" | "add_tag" | "move_pipeline_stage";

export interface TagAddedTriggerConfig {
  tag: string;
}

export interface OpportunityStageChangedTriggerConfig {
  stageId: string;
}

export interface SendEmailActionConfig {
  subject: string;
  body: string;
}

export interface AddTagActionConfig {
  tag: string;
}

export interface MovePipelineStageActionConfig {
  stageId: string;
}
