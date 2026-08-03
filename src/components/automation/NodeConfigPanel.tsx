"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { EmailBodyEditor } from "@/components/automation/EmailBodyEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { CONTACT_MERGE_TAGS } from "@/lib/automation/mergeTags";
import type { AutomationConditionType, AutomationNode, AutomationNodeType, AutomationTriggerType, PipelineStage } from "@/types";

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "contact_created", label: "Contact Created" },
  { value: "tag_added", label: "Tag Added to Contact" },
  { value: "opportunity_stage_changed", label: "Opportunity Moved to Stage" },
];

const CONDITION_OPTIONS: { value: AutomationConditionType; label: string }[] = [
  { value: "email_opened", label: "Email was opened" },
  { value: "has_tag", label: "Contact has tag" },
  { value: "opportunity_at_stage", label: "Contact's opportunity is at stage" },
  { value: "days_since_entered", label: "Days have passed" },
];

const NODE_TITLES: Record<AutomationNodeType, string> = {
  trigger: "Trigger",
  send_email: "Send Email",
  add_tag: "Add Tag",
  remove_tag: "Remove Tag",
  move_pipeline_stage: "Move Pipeline Stage",
  condition: "Condition",
  wait: "Wait",
};

interface NodeConfigPanelProps {
  node: AutomationNode;
  stages: PipelineStage[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  canDelete: boolean;
  onDuplicate: () => void;
  canDuplicate: boolean;
}

export function NodeConfigPanel({ node, stages, onClose, onSave, onDelete, canDelete, onDuplicate, canDuplicate }: NodeConfigPanelProps) {
  const [data, setData] = useState<Record<string, unknown>>(node.data);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

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

  function set(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function insertMergeTag(token: string) {
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
      toast.success(`Test email sent to ${testEmail.trim()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email.");
    } finally {
      setTestSending(false);
    }
  }

  function handleSave() {
    onSave(data);
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">{NODE_TITLES[node.type]}</h3>
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
            <div>
              <p className="text-text-secondary text-xs font-medium mb-1.5">Custom values — click to insert into the subject</p>
              <div className="flex flex-wrap gap-1.5">
                {CONTACT_MERGE_TAGS.map((tag) => (
                  <button
                    key={tag.token}
                    type="button"
                    onClick={() => insertMergeTag(tag.token)}
                    className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary hover:border-brand-primary hover:text-brand-primary"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
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
              <p className="text-text-muted mt-1 text-[11px]">Sends with sample contact data so you can check the output.</p>
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

            {data.conditionType === "email_opened" && (
              <p className="text-text-secondary text-xs">
                Checks whether the most recent email sent by this workflow was opened.
              </p>
            )}

            {data.conditionType === "has_tag" && (
              <Field label="Tag">
                <Input value={(data.tag as string) ?? ""} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. hot lead" />
              </Field>
            )}

            {data.conditionType === "opportunity_at_stage" && (
              <Field label="Stage">
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

            {data.conditionType === "days_since_entered" && (
              <Field label="Days since entering this workflow">
                <Input
                  type="number"
                  min={1}
                  value={(data.days as number) ?? ""}
                  onChange={(e) => set("days", Number(e.target.value))}
                  placeholder="e.g. 4"
                />
              </Field>
            )}

            {data.conditionType && (
              <p className="text-text-muted text-xs">
                Connect the <strong>Yes</strong> and <strong>No</strong> branches to whatever should happen next.
              </p>
            )}
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
                  <SelectItem value="condition">Until the email is opened</SelectItem>
                </SelectContent>
              </Select>
            </Field>
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
            <p className="text-text-muted text-xs">
              {(data.mode ?? "duration") === "duration"
                ? "This project runs on Vercel's free tier, which checks for due waits once a day — waits under a day may take up to 24h to fire. Upgrading the Vercel plan tightens this automatically."
                : "Resumes immediately when the tracking pixel in the sent email is loaded."}
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
