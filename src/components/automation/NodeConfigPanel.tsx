"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Plus as PlusIcon, RefreshCw, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { EmailBodyEditor } from "@/components/automation/EmailBodyEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { CONTACT_MERGE_TAGS } from "@/lib/automation/mergeTags";
import { NODE_DEFINITIONS } from "@/lib/automation/nodeRegistry";
import { COMMON_TIMEZONES, WEEKDAY_LABELS } from "@/lib/utils/schedule";
import type {
  Automation,
  AutomationConditionType,
  AutomationNode,
  AutomationTriggerType,
  ConditionCombinator,
  ConditionRule,
  ContactTextField,
  FieldComparisonOperator,
  PipelineStage,
} from "@/types";
import { CONTACT_FIELD_LABELS, CONTACT_TEXT_FIELDS } from "@/types";

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "contact_created", label: "Contact Created" },
  { value: "tag_added", label: "Tag Added to Contact" },
  { value: "opportunity_stage_changed", label: "Opportunity Moved to Stage" },
  { value: "opportunity_created", label: "Opportunity Created" },
  { value: "opportunity_won", label: "Opportunity Won" },
  { value: "opportunity_lost", label: "Opportunity Lost" },
  { value: "task_completed", label: "Task Completed" },
  { value: "note_added", label: "Note Added" },
  { value: "email_opened", label: "Email Opened" },
  { value: "webhook_received", label: "Webhook Received" },
];

const CONTACTLESS_TRIGGERS: AutomationTriggerType[] = ["task_completed", "note_added"];

const CONDITION_OPTIONS: { value: AutomationConditionType; label: string }[] = [
  { value: "email_opened", label: "Email was opened" },
  { value: "has_tag", label: "Contact has tag" },
  { value: "opportunity_at_stage", label: "Contact's opportunity is at stage" },
  { value: "days_since_entered", label: "Days have passed" },
  { value: "field_comparison", label: "Contact field comparison" },
];

const OPERATOR_OPTIONS: { value: FieldComparisonOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

interface SimpleUser {
  id: string;
  name: string;
}
interface SimpleProject {
  id: string;
  name: string;
}
interface SimpleCategory {
  id: string;
  name: string;
}

interface NodeConfigPanelProps {
  node: AutomationNode;
  stages: PipelineStage[];
  automationId?: string;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  canDelete: boolean;
  onDuplicate: () => void;
  canDuplicate: boolean;
}

export function NodeConfigPanel({ node, stages, automationId, onClose, onSave, onDelete, canDelete, onDuplicate, canDuplicate }: NodeConfigPanelProps) {
  const [data, setData] = useState<Record<string, unknown>>(node.data);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [projects, setProjects] = useState<SimpleProject[]>([]);
  const [categories, setCategories] = useState<SimpleCategory[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [regeneratingSecret, setRegeneratingSecret] = useState(false);

  useEffect(() => {
    setData(node.data);
  }, [node.id, node.data]);

  useEffect(() => {
    fetch("/api/gmail/accounts")
      .then((res) => res.json())
      .then((d) => setAccounts(d.emails ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/contacts/tags")
      .then((res) => res.json())
      .then((d) => setTagSuggestions(d.tags ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((d) => setUsers((d.users ?? []).map((u: SimpleUser) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/automations")
      .then((res) => res.json())
      .then((d) => setAutomations(d.automations ?? []))
      .catch(() => {});
  }, []);

  function set(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function insertMergeTagIntoSubject(token: string) {
    const el = subjectRef.current;
    const current = (data.subject as string) ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    set("subject", next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + token.length;
      el?.setSelectionRange(caret, caret);
    });
  }

  function insertMergeTagAppend(key: string) {
    return (token: string) => set(key, `${(data[key] as string) ?? ""}${token}`);
  }

  async function handleTestSend() {
    if (!testEmail.trim()) return;
    setTestSending(true);
    try {
      const res = await fetch("/api/automations/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail.trim(),
          subject: (data.subject as string) ?? "",
          body: (data.body as string) ?? "",
          cc: (data.cc as string) || undefined,
          fromEmail: (data.fromEmail as string) || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to send test email.");
      toast.success(
        result.usedContact
          ? `Sent to ${testEmail.trim()} with their real contact info`
          : `Sent to ${testEmail.trim()} with sample data (no contact found with that email)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email.");
    } finally {
      setTestSending(false);
    }
  }

  function handleSave() {
    onSave(data);
  }

  async function handleCopyWebhookUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Couldn't copy — copy it manually instead.");
    }
  }

  async function handleRegenerateWebhookSecret() {
    if (!automationId) return;
    setRegeneratingSecret(true);
    try {
      const res = await fetch(`/api/automations/${automationId}/webhook-secret`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to regenerate webhook URL.");
      setAutomations((prev) => prev.map((a) => (a.id === automationId ? { ...a, webhookSecret: result.webhookSecret } : a)));
      toast.success("Webhook URL regenerated — update any senders using the old one.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate webhook URL.");
    } finally {
      setRegeneratingSecret(false);
    }
  }

  const rules = (data.rules as ConditionRule[] | undefined) ?? [];
  const inCompoundMode = rules.length > 0;

  function updateLegacyField(key: string, value: unknown) {
    set(key, value);
  }

  function startCompoundMode() {
    const first: ConditionRule = {
      id: crypto.randomUUID(),
      conditionType: (data.conditionType as AutomationConditionType) ?? "email_opened",
      tag: data.tag as string | undefined,
      stageId: data.stageId as string | undefined,
      days: data.days as number | undefined,
      field: data.field as ContactTextField | undefined,
      operator: data.operator as FieldComparisonOperator | undefined,
      value: data.value as string | undefined,
    };
    const second: ConditionRule = { id: crypto.randomUUID(), conditionType: "has_tag" };
    set("rules", [first, second]);
    set("combinator", "AND" as ConditionCombinator);
  }

  function updateRule(id: string, patch: Partial<ConditionRule>) {
    set("rules", rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRule(id: string) {
    if (rules.length <= 1) return;
    set("rules", rules.filter((r) => r.id !== id));
  }

  function addRule() {
    set("rules", [...rules, { id: crypto.randomUUID(), conditionType: "has_tag" }]);
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">{NODE_DEFINITIONS[node.type].label}</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {node.type === "trigger" && (
          <>
            <Field label="When this happens">
              <Select value={(data.triggerType as string) ?? ""} onValueChange={(v) => set("triggerType", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {data.triggerType === "tag_added" && (
              <Field label="Tag">
                <Input value={(data.tag as string) ?? ""} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. hot lead" />
              </Field>
            )}
            {data.triggerType === "opportunity_stage_changed" && (
              <Field label="Stage">
                <Select value={(data.stageId as string) ?? ""} onValueChange={(v) => set("stageId", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {data.triggerType === "webhook_received" && (
              <WebhookTriggerFields
                automationId={automationId}
                webhookSecret={automations.find((a) => a.id === automationId)?.webhookSecret}
                data={data}
                onChange={set}
                onCopy={handleCopyWebhookUrl}
                onRegenerate={handleRegenerateWebhookSecret}
                regenerating={regeneratingSecret}
              />
            )}
            {CONTACTLESS_TRIGGERS.includes(data.triggerType as AutomationTriggerType) && (
              <p className="text-text-muted text-xs">
                This trigger has no associated contact — pair it with Notification, Webhook, Create Task, or End
                Workflow steps rather than contact-scoped ones.
              </p>
            )}
          </>
        )}

        {node.type === "send_email" && (
          <>
            <Field label="From">
              {accounts.length > 1 ? (
                <Select value={(data.fromEmail as string) || accounts[0]} onValueChange={(v) => set("fromEmail", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((email) => (
                      <SelectItem key={email} value={email}>
                        {email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="border-border bg-surface-secondary text-text-secondary flex h-9 w-full items-center rounded-input border px-3 text-sm">
                  {accounts[0] ?? "No agency email connected"}
                </div>
              )}
            </Field>
            <Field label="CC" hint="optional">
              <Input value={(data.cc as string) ?? ""} onChange={(e) => set("cc", e.target.value)} placeholder="cc@example.com" />
            </Field>
            <Field label="Subject">
              <Input ref={subjectRef} value={(data.subject as string) ?? ""} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <MergeTagRow onInsert={insertMergeTagIntoSubject} hint="click to insert into the subject" />
            <Field label="Body">
              <EmailBodyEditor value={(data.body as string) ?? ""} onChange={(html) => set("body", html)} />
            </Field>

            <div className="border-border border-t pt-3">
              <p className="text-text-secondary mb-1.5 text-xs font-medium">Send a test email</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestSend}
                  loading={testSending}
                  disabled={!testEmail.trim()}
                >
                  Send Test
                </Button>
              </div>
              <p className="text-text-muted mt-1 text-[11px]">
                Uses a real contact&apos;s info if this email matches one on file, otherwise sample data. No [TEST]
                prefix is added, so this also works as a genuine one-off send.
              </p>
            </div>
          </>
        )}

        {node.type === "add_tag" && (
          <Field label="Tag to add">
            <Input
              value={(data.tag as string) ?? ""}
              onChange={(e) => set("tag", e.target.value)}
              placeholder="e.g. customer"
              list="automation-tag-suggestions"
            />
          </Field>
        )}

        {node.type === "remove_tag" && (
          <Field label="Tag to remove">
            <Input
              value={(data.tag as string) ?? ""}
              onChange={(e) => set("tag", e.target.value)}
              placeholder="e.g. lead"
              list="automation-tag-suggestions"
            />
          </Field>
        )}

        {(node.type === "add_tag" || node.type === "remove_tag") && (
          <datalist id="automation-tag-suggestions">
            {tagSuggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        )}

        {node.type === "move_pipeline_stage" && (
          <Field label="Move contact's opportunity to">
            <Select
              value={(data.stageId as string) ?? ""}
              onValueChange={(v) => {
                set("stageId", v);
                set("stageName", stages.find((s) => s.id === v)?.name);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {node.type === "condition" && (
          <>
            {!inCompoundMode ? (
              <>
                <Field label="Check whether">
                  <Select value={(data.conditionType as string) ?? ""} onValueChange={(v) => set("conditionType", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <ConditionRuleFields
                  conditionType={(data.conditionType as AutomationConditionType) ?? "email_opened"}
                  tag={data.tag as string | undefined}
                  stageId={data.stageId as string | undefined}
                  days={data.days as number | undefined}
                  field={data.field as ContactTextField | undefined}
                  operator={data.operator as FieldComparisonOperator | undefined}
                  value={data.value as string | undefined}
                  stages={stages}
                  onChange={(patch) => {
                    if (patch.stageId !== undefined) updateLegacyField("stageName", stages.find((s) => s.id === patch.stageId)?.name);
                    Object.entries(patch).forEach(([k, v]) => updateLegacyField(k, v));
                  }}
                />

                <button
                  type="button"
                  onClick={startCompoundMode}
                  className="text-brand-primary flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <PlusIcon className="size-3" />
                  Add another condition
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary text-xs font-medium">Match</span>
                  <Select value={(data.combinator as string) ?? "AND"} onValueChange={(v) => set("combinator", v)}>
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">All (AND)</SelectItem>
                      <SelectItem value="OR">Any (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-text-secondary text-xs font-medium">of these:</span>
                </div>

                {rules.map((rule, i) => (
                  <div key={rule.id} className="border-border space-y-2 rounded-card border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted text-[10px] font-semibold uppercase tracking-widest">Condition {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        disabled={rules.length <= 1}
                        className="text-text-muted hover:text-danger disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <Select value={rule.conditionType} onValueChange={(v) => updateRule(rule.id, { conditionType: v as AutomationConditionType })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ConditionRuleFields
                      conditionType={rule.conditionType}
                      tag={rule.tag}
                      stageId={rule.stageId}
                      days={rule.days}
                      field={rule.field}
                      operator={rule.operator}
                      value={rule.value}
                      stages={stages}
                      onChange={(patch) => updateRule(rule.id, patch)}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addRule}
                  className="text-brand-primary flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <PlusIcon className="size-3" />
                  Add condition
                </button>
              </>
            )}

            <p className="text-text-muted text-xs">
              Connect the <strong>Yes</strong> and <strong>No</strong> branches to whatever should happen next.
            </p>
          </>
        )}

        {node.type === "split" && (
          <>
            <Field label="Percent down Path A" hint="the rest go down Path B">
              <Input
                type="number"
                min={0}
                max={100}
                value={(data.splitPercent as number | undefined) ?? 50}
                onChange={(e) => set("splitPercent", Math.min(100, Math.max(0, Number(e.target.value))))}
              />
            </Field>
            <p className="text-text-muted text-xs">
              Each contact is randomly assigned to <strong>A</strong> or <strong>B</strong> at the given split —
              useful for testing two different follow-up approaches against each other.
            </p>
          </>
        )}

        {node.type === "wait" && (
          <>
            <Field label="Wait for">
              <Select value={(data.mode as string) ?? "duration"} onValueChange={(v) => set("mode", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duration">A set amount of time</SelectItem>
                  <SelectItem value="schedule">A specific day &amp; time</SelectItem>
                  <SelectItem value="condition">Until the email is opened</SelectItem>
                  <SelectItem value="event">Before/after the contact's event date</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {data.mode === "event" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount">
                    <Input
                      type="number"
                      min={1}
                      value={(data.amount as number) ?? ""}
                      onChange={(e) => set("amount", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Unit">
                    <Select value={(data.unit as string) ?? "days"} onValueChange={(v) => set("unit", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Relative to the event date">
                  <Select value={(data.direction as string) ?? "before"} onValueChange={(v) => set("direction", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="If the wait time has already passed">
                  <Select value={(data.pastDueAction as string) ?? "continue"} onValueChange={(v) => set("pastDueAction", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continue">Skip ahead — continue to the next step</SelectItem>
                      <SelectItem value="end">End the workflow for this contact</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-text-muted text-xs">
                  Requires a <strong>Set Event Date</strong> step earlier in this workflow. A contact can reach this
                  step after the target moment has already gone by (e.g. enrolled late, or the event is close) — the
                  option above decides what happens then instead of waiting for a time already behind us.
                </p>
              </>
            )}
            {(data.mode ?? "duration") === "duration" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <Input
                    type="number"
                    min={1}
                    value={(data.amount as number) ?? ""}
                    onChange={(e) => set("amount", Number(e.target.value))}
                  />
                </Field>
                <Field label="Unit">
                  <Select value={(data.unit as string) ?? "hours"} onValueChange={(v) => set("unit", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
            {data.mode === "schedule" && (
              <>
                <Field label="Day of week">
                  <Select
                    value={data.dayOfWeek === null ? "any" : String((data.dayOfWeek as number) ?? 1)}
                    onValueChange={(v) => set("dayOfWeek", v === "any" ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any day — next occurrence of the time below</SelectItem>
                      {WEEKDAY_LABELS.map((label, i) => (
                        <SelectItem key={label} value={String(i)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Time">
                    <Input type="time" value={(data.time as string) ?? "09:00"} onChange={(e) => set("time", e.target.value)} />
                  </Field>
                  <Field label="Timezone">
                    <Select value={(data.timezone as string) || "America/New_York"} onValueChange={(v) => set("timezone", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}
            <p className="text-text-muted text-xs">
              {data.mode === "condition"
                ? "Resumes immediately when the tracking pixel in the sent email is loaded."
                : "This project runs on Vercel's free tier, which checks for due waits once a day — waits may fire up to 24h later than the exact time configured. Upgrading the Vercel plan tightens this automatically."}
            </p>
          </>
        )}

        {node.type === "create_task" && (
          <>
            <Field label="Project">
              <Select value={(data.projectId as string) ?? ""} onValueChange={(v) => set("projectId", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title">
              <Input value={(data.title as string) ?? ""} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <MergeTagRow onInsert={insertMergeTagAppend("title")} hint="click to insert into the title" />
            <Field label="Description" hint="optional">
              <Textarea value={(data.description as string) ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} />
            </Field>
            <Field label="Priority">
              <Select value={(data.priority as string) ?? "medium"} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due" hint="optional">
              <Input
                type="number"
                min={0}
                value={(data.dueDateOffsetDays as number) ?? ""}
                onChange={(e) => set("dueDateOffsetDays", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Days from creation"
              />
            </Field>
            <AssigneeFields
              mode={(data.assigneeMode as string) ?? "none"}
              assigneeId={data.assigneeId as string | undefined}
              roundRobinUserIds={(data.roundRobinUserIds as string[]) ?? []}
              users={users}
              onModeChange={(v) => set("assigneeMode", v)}
              onAssigneeChange={(v) => set("assigneeId", v)}
              onRoundRobinChange={(v) => set("roundRobinUserIds", v)}
              includeNone
            />
          </>
        )}

        {node.type === "create_note" && (
          <>
            <Field label="Project" hint="optional">
              <Select value={(data.projectId as string) ?? "__none"} onValueChange={(v) => set("projectId", v === "__none" ? undefined : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category" hint="optional">
              <Select value={(data.categoryId as string) ?? "__none"} onValueChange={(v) => set("categoryId", v === "__none" ? undefined : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title">
              <Input value={(data.title as string) ?? ""} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <MergeTagRow onInsert={insertMergeTagAppend("title")} hint="click to insert into the title" />
            <Field label="Content">
              <Textarea value={(data.content as string) ?? ""} onChange={(e) => set("content", e.target.value)} rows={5} />
            </Field>
          </>
        )}

        {node.type === "ai_prompt" && (
          <>
            <Field label="Prompt">
              <Textarea
                value={(data.prompt as string) ?? ""}
                onChange={(e) => set("prompt", e.target.value)}
                rows={5}
                placeholder={'e.g. "Write a short, friendly opening line for a follow-up email to {{contact.first_name}} at {{contact.company}}."'}
              />
            </Field>
            <MergeTagRow onInsert={insertMergeTagAppend("prompt")} hint="click to insert into the prompt" />
            <Field label="Save result to">
              <Select value={(data.field as string) ?? "notes"} onValueChange={(v) => set("field", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TEXT_FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {CONTACT_FIELD_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-text-muted text-xs">
              Overwrites whatever is already in that field with Claude's response — pair with an earlier
              step if you need to keep the original value elsewhere first.
            </p>
          </>
        )}

        {node.type === "create_opportunity" && (
          <>
            <Field label="Name">
              <Input value={(data.name as string) ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Defaults to the contact's name" />
            </Field>
            <MergeTagRow onInsert={insertMergeTagAppend("name")} hint="click to insert into the name" />
            <Field label="Value" hint="optional">
              <Input
                type="number"
                min={0}
                value={(data.value as number) ?? ""}
                onChange={(e) => set("value", e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
            <Field label="Stage">
              <Select value={(data.stageId as string) ?? ""} onValueChange={(v) => set("stageId", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {node.type === "update_contact_field" && (
          <>
            <Field label="Field">
              <Select value={(data.field as string) ?? ""} onValueChange={(v) => set("field", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TEXT_FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {CONTACT_FIELD_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="New value">
              <Input value={(data.value as string) ?? ""} onChange={(e) => set("value", e.target.value)} />
            </Field>
          </>
        )}

        {node.type === "update_opportunity" && (
          <>
            <Field label="Set status" hint="optional">
              <Select value={(data.status as string) ?? "__unchanged"} onValueChange={(v) => set("status", v === "__unchanged" ? undefined : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unchanged">Leave unchanged</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Set value" hint="optional">
              <Input
                type="number"
                min={0}
                value={(data.value as number) ?? ""}
                onChange={(e) => set("value", e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
            <p className="text-text-muted text-xs">Applies to the contact's most recent open opportunity.</p>
          </>
        )}

        {node.type === "assign_contact_to_user" && (
          <AssigneeFields
            mode={(data.mode as string) ?? "single"}
            assigneeId={data.assigneeId as string | undefined}
            roundRobinUserIds={(data.roundRobinUserIds as string[]) ?? []}
            users={users}
            onModeChange={(v) => set("mode", v)}
            onAssigneeChange={(v) => set("assigneeId", v)}
            onRoundRobinChange={(v) => set("roundRobinUserIds", v)}
          />
        )}

        {node.type === "send_notification" && (
          <>
            <AssigneeFields
              mode={(data.recipientMode as string) ?? "single"}
              assigneeId={data.recipientId as string | undefined}
              roundRobinUserIds={(data.roundRobinUserIds as string[]) ?? []}
              users={users}
              onModeChange={(v) => set("recipientMode", v)}
              onAssigneeChange={(v) => set("recipientId", v)}
              onRoundRobinChange={(v) => set("roundRobinUserIds", v)}
              label="Recipient"
            />
            <Field label="Title">
              <Input value={(data.title as string) ?? ""} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Message">
              <Textarea value={(data.body as string) ?? ""} onChange={(e) => set("body", e.target.value)} rows={3} />
            </Field>
          </>
        )}

        {node.type === "webhook" && (
          <WebhookFields data={data} onChange={set} />
        )}

        {node.type === "enroll_in_automation" && (
          <>
            <Field label="Automation">
              <Select value={(data.automationId as string) ?? ""} onValueChange={(v) => set("automationId", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a workflow" />
                </SelectTrigger>
                <SelectContent>
                  {automations.filter((a) => a.id !== automationId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-text-muted text-xs">Enrolls this contact into the selected workflow from its trigger.</p>
          </>
        )}

        {node.type === "end_workflow" && (
          <p className="text-text-secondary text-sm">Ends this contact's run here, regardless of any other steps.</p>
        )}

        {node.type === "set_event_date" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Event date &amp; time">
                <Input
                  type="datetime-local"
                  value={(data.value as string) ?? ""}
                  onChange={(e) => set("value", e.target.value)}
                />
              </Field>
              <Field label="Timezone">
                <Select value={(data.timezone as string) || "America/New_York"} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <p className="text-text-muted text-xs">
              Stores this date on the contact, interpreted in the timezone above. A later <strong>Wait</strong> step
              can then wait for a set amount of time before or after it — e.g. a reminder 4 days before a webinar.
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-4">
        <div className="flex gap-2">
          {canDelete && (
            <Button variant="ghost" className="text-danger" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          {canDuplicate && (
            <Button variant="ghost" onClick={onDuplicate} title="Insert a copy of this step right after it">
              <Copy className="size-4" />
              Duplicate
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-text-secondary text-xs font-medium">
        {label}
        {hint && <span className="text-text-muted font-normal"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function MergeTagRow({ onInsert, hint }: { onInsert: (token: string) => void; hint: string }) {
  return (
    <div>
      <p className="text-text-secondary text-xs font-medium mb-1.5">Custom values — {hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {CONTACT_MERGE_TAGS.map((tag) => (
          <button
            key={tag.token}
            type="button"
            onClick={() => onInsert(tag.token)}
            className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary hover:border-brand-primary hover:text-brand-primary"
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The type-specific fields for a single condition predicate — shared by the simple and compound-rules UI. */
function ConditionRuleFields({
  conditionType, tag, stageId, days, field, operator, value, stages, onChange,
}: {
  conditionType: AutomationConditionType;
  tag?: string;
  stageId?: string;
  days?: number;
  field?: ContactTextField;
  operator?: FieldComparisonOperator;
  value?: string;
  stages: PipelineStage[];
  onChange: (patch: Partial<ConditionRule>) => void;
}) {
  if (conditionType === "email_opened") {
    return <p className="text-text-secondary text-xs">Checks whether the most recent email sent by this workflow was opened.</p>;
  }
  if (conditionType === "has_tag") {
    return (
      <Field label="Tag">
        <Input value={tag ?? ""} onChange={(e) => onChange({ tag: e.target.value })} placeholder="e.g. hot lead" />
      </Field>
    );
  }
  if (conditionType === "opportunity_at_stage") {
    return (
      <Field label="Stage">
        <Select value={stageId ?? ""} onValueChange={(v) => onChange({ stageId: v })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }
  if (conditionType === "days_since_entered") {
    return (
      <Field label="Days since entering this workflow">
        <Input type="number" min={1} value={days ?? ""} onChange={(e) => onChange({ days: Number(e.target.value) })} placeholder="e.g. 4" />
      </Field>
    );
  }
  // field_comparison
  return (
    <div className="space-y-2">
      <Field label="Contact field">
        <Select value={field ?? ""} onValueChange={(v) => onChange({ field: v as ContactTextField })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a field" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_TEXT_FIELDS.map((f) => (
              <SelectItem key={f} value={f}>
                {CONTACT_FIELD_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Operator">
        <Select value={operator ?? "equals"} onValueChange={(v) => onChange({ operator: v as FieldComparisonOperator })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {operator !== "is_empty" && operator !== "is_not_empty" && (
        <Field label="Value">
          <Input value={value ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
        </Field>
      )}
    </div>
  );
}

/** Single-user or round-robin assignee picker — shared by Create Task, Assign to User, and Send Notification. */
function AssigneeFields({
  mode, assigneeId, roundRobinUserIds, users, onModeChange, onAssigneeChange, onRoundRobinChange, label = "Assignee", includeNone = false,
}: {
  mode: string;
  assigneeId?: string;
  roundRobinUserIds: string[];
  users: SimpleUser[];
  onModeChange: (v: string) => void;
  onAssigneeChange: (v: string) => void;
  onRoundRobinChange: (v: string[]) => void;
  label?: string;
  includeNone?: boolean;
}) {
  return (
    <>
      <Field label={label}>
        <Select value={mode} onValueChange={onModeChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {includeNone && <SelectItem value="none">None</SelectItem>}
            <SelectItem value="single">A specific person</SelectItem>
            <SelectItem value="round_robin">Round robin</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {mode === "single" && (
        <Field label="Person">
          <Select value={assigneeId ?? ""} onValueChange={onAssigneeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a person" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {mode === "round_robin" && (
        <Field label="Rotate between">
          <div className="border-border max-h-36 space-y-1.5 overflow-y-auto rounded-input border p-2">
            {users.map((u) => {
              const checked = roundRobinUserIds.includes(u.id);
              return (
                <label key={u.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onRoundRobinChange(e.target.checked ? [...roundRobinUserIds, u.id] : roundRobinUserIds.filter((id) => id !== u.id))
                    }
                    className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                  />
                  {u.name}
                </label>
              );
            })}
          </div>
        </Field>
      )}
    </>
  );
}

/** Config UI for the inbound "Webhook Received" trigger — the URL an external app POSTs to, and how to map that payload to a contact. */
function WebhookTriggerFields({
  automationId, webhookSecret, data, onChange, onCopy, onRegenerate, regenerating,
}: {
  automationId?: string;
  webhookSecret?: string;
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onCopy: (url: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  if (!automationId || !webhookSecret) {
    return <p className="text-text-muted text-xs">Save this automation first, then reopen this step to get its webhook URL.</p>;
  }

  const url = `${window.location.origin}/api/automations/webhook/${webhookSecret}`;

  return (
    <>
      <Field label="Webhook URL" hint="POST JSON here to trigger this automation">
        <div className="flex gap-1.5">
          <Input value={url} readOnly className="flex-1 font-mono text-xs" />
          <Button type="button" variant="secondary" size="sm" onClick={() => onCopy(url)} title="Copy">
            <Copy className="size-3.5" />
          </Button>
        </div>
      </Field>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className="text-danger flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-50"
      >
        <RefreshCw className={`size-3 ${regenerating ? "animate-spin" : ""}`} />
        Regenerate URL (invalidates the old one)
      </button>

      <div className="border-border space-y-3 border-t pt-3">
        <Field label="Match contact by" hint="key in the incoming JSON body">
          <Input value={(data.contactField as string) ?? ""} onChange={(e) => onChange("contactField", e.target.value)} placeholder="email" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-text-secondary select-none">
          <input
            type="checkbox"
            checked={(data.createContact as boolean) ?? false}
            onChange={(e) => onChange("createContact", e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
          />
          Create a contact if none match
        </label>
        {(data.createContact as boolean) && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name field" hint="optional">
              <Input value={(data.nameField as string) ?? ""} onChange={(e) => onChange("nameField", e.target.value)} placeholder="name" />
            </Field>
            <Field label="Phone field" hint="optional">
              <Input value={(data.phoneField as string) ?? ""} onChange={(e) => onChange("phoneField", e.target.value)} placeholder="phone" />
            </Field>
            <Field label="Company field" hint="optional">
              <Input value={(data.companyField as string) ?? ""} onChange={(e) => onChange("companyField", e.target.value)} placeholder="company" />
            </Field>
          </div>
        )}
        <p className="text-text-muted text-xs">
          Every field in the incoming JSON body is available to later steps as{" "}
          <code className="rounded bg-surface-secondary px-1">{"{{webhook.fieldname}}"}</code>. If no contact matches
          (and creation is off), the run continues without a contact — pair it with contact-independent steps.
        </p>
      </div>
    </>
  );
}

function WebhookFields({ data, onChange }: { data: Record<string, unknown>; onChange: (key: string, value: unknown) => void }) {
  const extraFields = (data.extraFields as { key: string; value: string }[]) ?? [];
  const headerFields = (data.headers as { key: string; value: string }[]) ?? [];
  const method = (data.method as string) ?? "POST";
  const hasBody = method === "POST" || method === "PUT" || method === "PATCH";
  const authType = (data.authType as string) ?? "none";
  const bodyMode = (data.bodyMode as string) ?? "auto";

  function updateField(i: number, patch: Partial<{ key: string; value: string }>) {
    onChange("extraFields", extraFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeField(i: number) {
    onChange("extraFields", extraFields.filter((_, idx) => idx !== i));
  }
  function addField() {
    onChange("extraFields", [...extraFields, { key: "", value: "" }]);
  }

  function updateHeader(i: number, patch: Partial<{ key: string; value: string }>) {
    onChange("headers", headerFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeHeader(i: number) {
    onChange("headers", headerFields.filter((_, idx) => idx !== i));
  }
  function addHeader() {
    onChange("headers", [...headerFields, { key: "", value: "" }]);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method">
          <Select value={method} onValueChange={(v) => onChange("method", v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Authentication">
          <Select value={authType} onValueChange={(v) => onChange("authType", v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer token</SelectItem>
              <SelectItem value="basic">Basic auth</SelectItem>
              <SelectItem value="header">Custom header</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="URL">
        <Input value={(data.url as string) ?? ""} onChange={(e) => onChange("url", e.target.value)} placeholder="https://..." />
      </Field>

      {authType === "bearer" && (
        <Field label="Token">
          <Input value={(data.authToken as string) ?? ""} onChange={(e) => onChange("authToken", e.target.value)} placeholder="Merge tags work here" />
        </Field>
      )}
      {authType === "basic" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username">
            <Input value={(data.authUsername as string) ?? ""} onChange={(e) => onChange("authUsername", e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" value={(data.authPassword as string) ?? ""} onChange={(e) => onChange("authPassword", e.target.value)} />
          </Field>
        </div>
      )}
      {authType === "header" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Header name">
            <Input value={(data.authHeaderName as string) ?? ""} onChange={(e) => onChange("authHeaderName", e.target.value)} placeholder="X-Api-Key" />
          </Field>
          <Field label="Header value">
            <Input value={(data.authHeaderValue as string) ?? ""} onChange={(e) => onChange("authHeaderValue", e.target.value)} />
          </Field>
        </div>
      )}

      <div>
        <p className="text-text-secondary mb-1.5 text-xs font-medium">Headers</p>
        <div className="space-y-2">
          {headerFields.map((f, i) => (
            <div key={i} className="flex gap-1.5">
              <Input value={f.key} onChange={(e) => updateHeader(i, { key: e.target.value })} placeholder="key" className="w-24" />
              <Input value={f.value} onChange={(e) => updateHeader(i, { value: e.target.value })} placeholder="value" className="flex-1" />
              <button type="button" onClick={() => removeHeader(i)} className="text-text-muted hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addHeader} className="text-brand-primary mt-2 flex items-center gap-1 text-xs font-medium hover:underline">
          <PlusIcon className="size-3" />
          Add header
        </button>
      </div>

      {hasBody && (
        <>
          <Field label="Body">
            <Select value={bodyMode} onValueChange={(v) => onChange("bodyMode", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automation + contact info, plus fields below</SelectItem>
                <SelectItem value="raw">Raw JSON</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {bodyMode === "raw" ? (
            <Field label="Raw body" hint="merge tags work here">
              <Textarea
                value={(data.rawBody as string) ?? ""}
                onChange={(e) => onChange("rawBody", e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </Field>
          ) : (
            <div>
              <p className="text-text-secondary mb-1.5 text-xs font-medium">Extra fields</p>
              <div className="space-y-2">
                {extraFields.map((f, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} placeholder="key" className="w-24" />
                    <Input value={f.value} onChange={(e) => updateField(i, { value: e.target.value })} placeholder="value" className="flex-1" />
                    <button type="button" onClick={() => removeField(i)} className="text-text-muted hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addField} className="text-brand-primary mt-2 flex items-center gap-1 text-xs font-medium hover:underline">
                <PlusIcon className="size-3" />
                Add field
              </button>
            </div>
          )}
        </>
      )}

      <Field label="Save response as" hint="optional">
        <Input
          value={(data.responseVariable as string) ?? ""}
          onChange={(e) => onChange("responseVariable", e.target.value)}
          placeholder="e.g. lookup"
        />
      </Field>
      <p className="text-text-muted text-xs">
        Merge tags work in the URL, auth, headers, and body. If you name a response variable, later steps can
        reference fields from the JSON response as{" "}
        <code className="rounded bg-surface-secondary px-1">{"{{http.<name>.<field>}}"}</code>.
      </p>
    </>
  );
}
