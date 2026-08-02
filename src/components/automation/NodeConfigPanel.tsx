"use client";

import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CONTACT_MERGE_TAGS } from "@/lib/automation/mergeTags";
import type { AutomationNode, AutomationNodeType, AutomationTriggerType, PipelineStage } from "@/types";

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "contact_created", label: "Contact Created" },
  { value: "tag_added", label: "Tag Added to Contact" },
  { value: "opportunity_stage_changed", label: "Opportunity Moved to Stage" },
];

const NODE_TITLES: Record<AutomationNodeType, string> = {
  trigger: "Trigger",
  send_email: "Send Email",
  add_tag: "Add Tag",
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
}

export function NodeConfigPanel({ node, stages, onClose, onSave, onDelete, canDelete }: NodeConfigPanelProps) {
  const [data, setData] = useState<Record<string, unknown>>(node.data);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [focusedField, setFocusedField] = useState<"subject" | "body">("body");

  useEffect(() => {
    setData(node.data);
  }, [node.id, node.data]);

  function set(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function insertMergeTag(token: string) {
    const key = focusedField;
    const el = key === "subject" ? subjectRef.current : bodyRef.current;
    const current = (data[key] as string) ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    set(key, next);

    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + token.length;
      el?.setSelectionRange(caret, caret);
    });
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
            <Field label="Subject">
              <Input
                ref={subjectRef}
                value={(data.subject as string) ?? ""}
                onChange={(e) => set("subject", e.target.value)}
                onFocus={() => setFocusedField("subject")}
              />
            </Field>
            <Field label="Body">
              <Textarea
                ref={bodyRef}
                rows={6}
                value={(data.body as string) ?? ""}
                onChange={(e) => set("body", e.target.value)}
                onFocus={() => setFocusedField("body")}
              />
            </Field>
            <div>
              <p className="text-text-secondary text-xs font-medium mb-1.5">
                Custom values — click to insert into the {focusedField === "subject" ? "subject" : "body"}
              </p>
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
          </>
        )}

        {node.type === "add_tag" && (
          <Field label="Tag to add">
            <Input value={(data.tag as string) ?? ""} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. customer" />
          </Field>
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
          <p className="text-text-secondary text-sm">
            Checks whether the most recent email sent by this workflow was opened. Connect the <strong>Yes</strong>{" "}
            and <strong>No</strong> branches to whatever should happen next.
          </p>
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
        {canDelete ? (
          <Button variant="ghost" className="text-danger" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        ) : (
          <span />
        )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-text-secondary text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
