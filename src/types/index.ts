export type UserRole = "admin" | "member";
export type UserStatus = "invited" | "active" | "suspended";
export type ProjectStatus = "active" | "on-hold" | "completed" | "archived";
export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type AccessLevel = "viewer" | "contributor" | "manager";
export type PermissionType =
  | "projects.view"
  | "projects.create"
  | "projects.manage"
  | "tasks.view"
  | "tasks.create"
  | "tasks.manage"
  | "notes.view"
  | "notes.create"
  | "notes.manage"
  | "leads.view"
  | "leads.manage"
  | "contacts.view"
  | "contacts.manage"
  | "pipeline.view"
  | "pipeline.manage"
  | "automation.view"
  | "automation.manage"
  | "team.view"
  | "company.email"
  | "ai.task_assistant"
  | "ai.consultant"
  | "admin.users"
  | "admin.settings";

export const ALL_PERMISSIONS: { key: PermissionType; label: string; group: string }[] = [
  { key: "projects.view", label: "View Projects", group: "Projects" },
  { key: "projects.create", label: "Create Projects", group: "Projects" },
  { key: "projects.manage", label: "Manage Projects", group: "Projects" },
  { key: "tasks.view", label: "View Tasks", group: "Tasks" },
  { key: "tasks.create", label: "Create Tasks", group: "Tasks" },
  { key: "tasks.manage", label: "Manage Tasks", group: "Tasks" },
  { key: "notes.view", label: "View Notes", group: "Notes" },
  { key: "notes.create", label: "Create Notes", group: "Notes" },
  { key: "notes.manage", label: "Manage Notes", group: "Notes" },
  { key: "leads.view", label: "View Leads", group: "Leads" },
  { key: "leads.manage", label: "Manage Leads", group: "Leads" },
  { key: "contacts.view", label: "View Contacts", group: "Contacts" },
  { key: "contacts.manage", label: "Manage Contacts", group: "Contacts" },
  { key: "pipeline.view", label: "View Pipeline", group: "Pipeline" },
  { key: "pipeline.manage", label: "Manage Pipeline", group: "Pipeline" },
  { key: "automation.view", label: "View Automations", group: "Automation" },
  { key: "automation.manage", label: "Manage Automations", group: "Automation" },
  { key: "team.view", label: "View Team", group: "Team" },
  { key: "company.email", label: "Access Company Email", group: "Inbox" },
  { key: "ai.task_assistant", label: "Task Assistant", group: "AI" },
  { key: "ai.consultant", label: "Business Consultant", group: "AI" },
  { key: "admin.users", label: "Manage Users", group: "Admin" },
  { key: "admin.settings", label: "App Settings", group: "Admin" },
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  status: UserStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  permissions: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  ownerId: string;
  owner: { id: string; name: string; avatarUrl: string | null };
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
  userAccessLevel?: AccessLevel | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  project?: { id: string; name: string; color: string };
  assigneeId: string | null;
  assignee?: { id: string; name: string; avatarUrl: string | null } | null;
  creatorId: string;
  creator?: { id: string; name: string };
  dueDate: string | null;
  tags: string[];
  parentTaskId: string | null;
  subtasks?: Task[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  categoryId: string | null;
  category?: { id: string; name: string; color: string; icon: string | null } | null;
  authorId: string;
  author: { id: string; name: string; avatarUrl: string | null };
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  createdAt: string;
  _count?: { notes: number };
}

export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  invitedBy: { name: string; email: string };
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  user: { name: string; avatarUrl: string | null };
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

export interface ProjectAccess {
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null; role: string };
  accessLevel: AccessLevel;
  grantedById: string;
  createdAt: string;
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#9CA3AF",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in-progress",
  "review",
  "done",
];

export type CalendarEventType = "event" | "meeting" | "deadline";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  color: string | null;
  taskId: string | null;
  task?: { id: string; title: string; status: string } | null;
  createdById: string;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  attendees: { userId: string; user: { id: string; name: string; avatarUrl: string | null } }[];
  createdAt: string;
  updatedAt: string;
}

export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  meeting: "#2563EB",
  event: "#0F7B8A",
  deadline: "#DC2626",
};

export type LeadStatus = "New" | "Contacted" | "Meeting Scheduled" | "Proposal Sent" | "Won" | "Lost";

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Meeting Scheduled",
  "Proposal Sent",
  "Won",
  "Lost",
];

export interface LeadAudit {
  id: string;
  leadId: string;
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  mobileFriendly: boolean | null;
  httpsEnabled: boolean | null;
  hasMetaDescription: boolean | null;
  hasTitle: boolean | null;
  sslValid: boolean | null;
  pageSpeed: number | null;
  overallScore: number | null;
  lastScanned: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  googlePlaceId: string;
  name: string;
  category: string | null;
  businessStatus: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  opportunityScore: number;
  opportunityScoreUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  audit?: LeadAudit | null;
}

export interface SavedLead {
  id: string;
  userId: string;
  leadId: string;
  lead?: Lead;
  status: LeadStatus;
  notes: string | null;
  tags: string[];
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSearch {
  id: string;
  userId: string;
  keyword: string;
  location: string;
  radius: number | null;
  resultsCount: number;
  createdAt: string;
}

export interface Contact {
  id: string;
  createdById: string;
  createdBy?: { id: string; name: string };
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
  sourceLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
}

export interface Pipeline {
  id: string;
  name: string;
  createdAt: string;
  stages: PipelineStage[];
}

export type OpportunityStatus = "open" | "won" | "lost";

export interface Opportunity {
  id: string;
  name: string;
  value: number | null;
  status: OpportunityStatus;
  contactId: string;
  contact?: { id: string; name: string; company: string | null };
  pipelineId: string;
  stageId: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type AutomationTriggerType = "contact_created" | "tag_added" | "opportunity_stage_changed";
export type AutomationActionType = "send_email" | "add_tag" | "move_pipeline_stage";

export interface AutomationAction {
  id: string;
  automationId: string;
  order: number;
  actionType: AutomationActionType;
  config: Record<string, string>;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  contactId: string | null;
  status: "success" | "error";
  detail: string | null;
  createdAt: string;
}

export interface Automation {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, string>;
  createdById: string;
  actions: AutomationAction[];
  runs?: AutomationRun[];
  createdAt: string;
  updatedAt: string;
}
