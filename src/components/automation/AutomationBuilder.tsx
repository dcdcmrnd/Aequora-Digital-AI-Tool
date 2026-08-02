"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, GitBranch, Mail, Plus, Tag, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { type AutomationActionInput, type AutomationInput, useAutomations } from "@/hooks/useAutomations";
import { usePipeline } from "@/hooks/usePipeline";
import type { Automation, AutomationActionType, AutomationTriggerType } from "@/types";

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "contact_created", label: "Contact Created" },
  { value: "tag_added", label: "Tag Added to Contact" },
  { value: "opportunity_stage_changed", label: "Opportunity Moved to Stage" },
];

const ACTION_OPTIONS: { value: AutomationActionType; label: string; icon: typeof Mail }[] = [
  { value: "send_email", label: "Send Email", icon: Mail },
  { value: "add_tag", label: "Add Tag", icon: Tag },
  { value: "move_pipeline_stage", label: "Move to Pipeline Stage", icon: GitBranch },
];

function iconForAction(actionType: AutomationActionType) {
  return ACTION_OPTIONS.find((o) => o.value === actionType)?.icon ?? Mail;
}

interface AutomationBuilderProps {
  automation?: Automation;
}

export function AutomationBuilder({ automation }: AutomationBuilderProps) {
  const router = useRouter();
  const { pipeline } = usePipeline();
  const { createAutomation, updateAutomation } = useAutomations();
  const isEditing = !!automation;

  const [name, setName] = useState(automation?.name ?? "");
  const [isActive, setIsActive] = useState(automation?.isActive ?? true);
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(automation?.triggerType ?? "contact_created");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(automation?.triggerConfig ?? {});
  const [actions, setActions] = useState<AutomationActionInput[]>(
    automation?.actions.map((a) => ({ actionType: a.actionType, config: a.config })) ?? [],
  );

  const isSaving = createAutomation.isPending || updateAutomation.isPending;
  const stages = pipeline?.stages ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];

  function insertActionAt(index: number) {
    setActions((prev) => {
      const next = [...prev];
      next.splice(index, 0, { actionType: "send_email", config: {} });
      return next;
    });
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAction(index: number, patch: Partial<AutomationActionInput>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || actions.length === 0) return;

    const input: AutomationInput = { name: name.trim(), triggerType, triggerConfig, isActive, actions };
    const onSuccess = { onSuccess: () => router.push("/automation") };

    if (isEditing) {
      updateAutomation.mutate({ id: automation.id, ...input }, onSuccess);
    } else {
      createAutomation.mutate(input, onSuccess);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => router.push("/automation")}>
        <ArrowLeft className="size-4" />
        Back to automations
      </Button>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-card border border-border bg-white p-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-text-secondary text-xs font-medium">
              Name<span className="text-danger"> *</span>
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome new contacts" />
          </label>

          <label className="flex items-center gap-2 text-sm text-text-secondary select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
            />
            Active
          </label>
        </div>

        {/* Workflow: trigger connected down through each action */}
        <div className="flex flex-col items-stretch">
          <FlowNode icon={Zap} accent="trigger" title="Trigger" subtitle="When this happens...">
            <Select
              value={triggerType}
              onValueChange={(v) => {
                setTriggerType(v as AutomationTriggerType);
                setTriggerConfig({});
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {triggerType === "tag_added" && (
              <Input
                className="mt-2"
                value={triggerConfig.tag ?? ""}
                onChange={(e) => setTriggerConfig({ tag: e.target.value })}
                placeholder="Tag, e.g. hot lead"
              />
            )}

            {triggerType === "opportunity_stage_changed" && (
              <Select
                value={triggerConfig.stageId ?? ""}
                onValueChange={(v) => setTriggerConfig({ stageId: v })}
              >
                <SelectTrigger className="mt-2 w-full">
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
            )}
          </FlowNode>

          <Connector onInsert={() => insertActionAt(0)} />

          {actions.map((action, index) => (
            <div key={index} className="flex flex-col items-stretch">
              <FlowNode
                icon={iconForAction(action.actionType)}
                accent="action"
                title={`Action ${index + 1}`}
                onDelete={() => removeAction(index)}
              >
                <Select
                  value={action.actionType}
                  onValueChange={(v) => updateAction(index, { actionType: v as AutomationActionType, config: {} })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {action.actionType === "send_email" && (
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="Subject"
                      value={action.config.subject ?? ""}
                      onChange={(e) => updateAction(index, { config: { ...action.config, subject: e.target.value } })}
                    />
                    <Textarea
                      placeholder="Email body"
                      rows={3}
                      value={action.config.body ?? ""}
                      onChange={(e) => updateAction(index, { config: { ...action.config, body: e.target.value } })}
                    />
                  </div>
                )}

                {action.actionType === "add_tag" && (
                  <Input
                    className="mt-2"
                    placeholder="Tag to add"
                    value={action.config.tag ?? ""}
                    onChange={(e) => updateAction(index, { config: { tag: e.target.value } })}
                  />
                )}

                {action.actionType === "move_pipeline_stage" && (
                  <Select
                    value={action.config.stageId ?? ""}
                    onValueChange={(v) => updateAction(index, { config: { stageId: v } })}
                  >
                    <SelectTrigger className="mt-2 w-full">
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
                )}
              </FlowNode>

              <Connector onInsert={() => insertActionAt(index + 1)} />
            </div>
          ))}

          {actions.length === 0 && (
            <p className="text-text-muted -mt-2 pb-2 text-center text-sm">Add an action to complete the workflow.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/automation")}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} disabled={!name.trim() || actions.length === 0}>
            {isEditing ? "Save Changes" : "Create Automation"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  accent,
  title,
  subtitle,
  onDelete,
  children,
}: {
  icon: typeof Zap;
  accent: "trigger" | "action";
  title: string;
  subtitle?: string;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              accent === "trigger" ? "bg-brand-primary/10 text-brand-primary" : "bg-blue-50 text-blue-600",
            )}
          >
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-text-primary text-sm font-semibold leading-tight">{title}</p>
            {subtitle && <p className="text-text-muted text-xs">{subtitle}</p>}
          </div>
        </div>
        {onDelete && (
          <button type="button" onClick={onDelete} className="text-text-muted hover:text-danger">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Connector({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-border h-4 w-0.5" />
      <button
        type="button"
        onClick={onInsert}
        title="Insert action here"
        className="border-border text-text-muted hover:border-brand-primary hover:text-brand-primary flex size-6 shrink-0 items-center justify-center rounded-full border bg-white transition-colors"
      >
        <Plus className="size-3.5" />
      </button>
      <div className="bg-border h-4 w-0.5" />
    </div>
  );
}
