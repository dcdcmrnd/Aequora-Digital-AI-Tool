"use client";

import Link from "next/link";
import { Loader2, Plus, Trash2, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAutomations } from "@/hooks/useAutomations";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import type { Automation, AutomationTriggerType } from "@/types";

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  contact_created: "Contact Created",
  tag_added: "Tag Added to Contact",
  opportunity_stage_changed: "Opportunity Moved to Stage",
};

const STATUS_STYLES: Record<string, string> = {
  error: "text-danger",
  completed: "text-success",
  waiting: "text-warning",
  running: "text-text-secondary",
};

function summarizeAutomation(automation: Automation): string {
  const triggerNode = automation.flow.nodes.find((n) => n.type === "trigger");
  const triggerType = triggerNode?.data.triggerType as AutomationTriggerType | undefined;
  const triggerLabel = triggerType ? TRIGGER_LABELS[triggerType] : "No trigger configured";
  const stepCount = automation.flow.nodes.filter((n) => n.type !== "trigger").length;
  return `${triggerLabel} · ${stepCount} step${stepCount === 1 ? "" : "s"}`;
}

export function AutomationsListView() {
  const { automations, isLoading, updateAutomation, deleteAutomation } = useAutomations();
  const canManage = usePermission("automation.manage");

  function handleDelete(automation: Automation) {
    if (!confirm(`Delete automation "${automation.name}"?`)) return;
    deleteAutomation.mutate(automation.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Automation</h1>
          <p className="text-text-muted text-sm">Trigger actions automatically when something happens.</p>
        </div>
        {canManage && (
          <Link href="/automation/new">
            <Button>
              <Plus className="size-4" />
              New Automation
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : automations && automations.length > 0 ? (
        <div className="flex flex-col gap-3">
          {automations.map((automation) => {
            const lastRun = automation.runs?.[0];
            return (
              <div
                key={automation.id}
                className="rounded-card border border-border bg-white p-4 flex items-center gap-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <Zap className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/automation/${automation.id}`} className="text-text-primary font-medium hover:underline">
                    {automation.name}
                  </Link>
                  <p className="text-text-muted text-xs mt-0.5">
                    {summarizeAutomation(automation)}
                    {lastRun && (
                      <>
                        {" · Last run: "}
                        <span className={STATUS_STYLES[lastRun.status] ?? "text-text-secondary"}>{lastRun.status}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-text-secondary">
                  <span className="flex items-center gap-1" title="Contacts entered this workflow">
                    <Users className="size-3.5" />
                    {automation.contactsEntered ?? 0} entered
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      (automation.activeContacts ?? 0) > 0 && "text-brand-primary font-medium",
                    )}
                    title="Contacts currently active in this workflow"
                  >
                    <Loader2 className={cn("size-3.5", (automation.activeContacts ?? 0) > 0 && "animate-spin")} />
                    {automation.activeContacts ?? 0} active
                  </span>
                </div>
                <Badge variant={automation.isActive ? "success" : "muted"}>
                  {automation.isActive ? "Active" : "Inactive"}
                </Badge>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary select-none">
                      <input
                        type="checkbox"
                        checked={automation.isActive}
                        onChange={(e) => updateAutomation.mutate({ id: automation.id, isActive: e.target.checked })}
                        className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                      />
                    </label>
                    <button onClick={() => handleDelete(automation)} className="text-text-muted hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-text-muted text-sm">
          No automations yet. {canManage && "Create one to get started."}
        </p>
      )}
    </div>
  );
}
