"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { type AutomationActionInput, type AutomationInput, useAutomations } from "@/hooks/useAutomations";
import { usePipeline } from "@/hooks/usePipeline";
import type { Automation, AutomationActionType, AutomationTriggerType } from "@/types";

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "contact_created", label: "Contact Created" },
  { value: "tag_added", label: "Tag Added to Contact" },
  { value: "opportunity_stage_changed", label: "Opportunity Moved to Stage" },
];

const ACTION_OPTIONS: { value: AutomationActionType; label: string }[] = [
  { value: "send_email", label: "Send Email" },
  { value: "add_tag", label: "Add Tag" },
  { value: "move_pipeline_stage", label: "Move to Pipeline Stage" },
];

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
    automation?.actions.map((a) => ({ actionType: a.actionType, config: a.config })) ?? [
      { actionType: "send_email", config: {} },
    ],
  );

  const isSaving = createAutomation.isPending || updateAutomation.isPending;
  const stages = pipeline?.stages ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];

  function addAction() {
    setActions((prev) => [...prev, { actionType: "send_email", config: {} }]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveAction(index: number, direction: -1 | 1) {
    setActions((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
    <div className="max-w-2xl space-y-6">
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

        <div className="rounded-card border border-border bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Trigger</h3>
          <Select value={triggerType} onValueChange={(v) => { setTriggerType(v as AutomationTriggerType); setTriggerConfig({}); }}>
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
            <label className="block space-y-1">
              <span className="text-text-secondary text-xs font-medium">Tag</span>
              <Input
                value={triggerConfig.tag ?? ""}
                onChange={(e) => setTriggerConfig({ tag: e.target.value })}
                placeholder="e.g. hot lead"
              />
            </label>
          )}

          {triggerType === "opportunity_stage_changed" && (
            <label className="block space-y-1">
              <span className="text-text-secondary text-xs font-medium">Stage</span>
              <Select value={triggerConfig.stageId ?? ""} onValueChange={(v) => setTriggerConfig({ stageId: v })}>
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
            </label>
          )}
        </div>

        <div className="rounded-card border border-border bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Actions</h3>
          {actions.map((action, index) => (
            <div key={index} className="rounded-input border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs font-medium w-4">{index + 1}.</span>
                <Select
                  value={action.actionType}
                  onValueChange={(v) => updateAction(index, { actionType: v as AutomationActionType, config: {} })}
                >
                  <SelectTrigger className="flex-1">
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
                <button
                  type="button"
                  onClick={() => moveAction(index, -1)}
                  disabled={index === 0}
                  className="text-text-muted hover:text-text-primary disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveAction(index, 1)}
                  disabled={index === actions.length - 1}
                  className="text-text-muted hover:text-text-primary disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  disabled={actions.length === 1}
                  className="text-text-muted hover:text-danger disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {action.actionType === "send_email" && (
                <div className="space-y-2 pl-6">
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
                <div className="pl-6">
                  <Input
                    placeholder="Tag to add"
                    value={action.config.tag ?? ""}
                    onChange={(e) => updateAction(index, { config: { tag: e.target.value } })}
                  />
                </div>
              )}

              {action.actionType === "move_pipeline_stage" && (
                <div className="pl-6">
                  <Select
                    value={action.config.stageId ?? ""}
                    onValueChange={(v) => updateAction(index, { config: { stageId: v } })}
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
                </div>
              )}
            </div>
          ))}

          <Button type="button" variant="secondary" size="sm" onClick={addAction}>
            <Plus className="size-3.5" />
            Add Action
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/automation")}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} disabled={!name.trim()}>
            {isEditing ? "Save Changes" : "Create Automation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
