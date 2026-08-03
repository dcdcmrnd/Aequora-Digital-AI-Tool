"use client";

import { useState } from "react";
import { CheckCircle2, Clock, User, XCircle } from "lucide-react";

import { NODE_DEFINITIONS } from "@/lib/automation/nodeRegistry";
import { Badge } from "@/components/ui/Badge";
import { useAutomationRuns } from "@/hooks/useAutomations";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { AutomationRun, AutomationRunStep } from "@/types";

const STATUS_META: Record<AutomationRun["status"], { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  running: { label: "Running", variant: "muted" },
  waiting: { label: "Waiting", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  error: { label: "Error", variant: "danger" },
};

function StepIcon({ status }: { status: AutomationRunStep["status"] }) {
  if (status === "error") return <XCircle className="size-4 text-danger" />;
  if (status === "waiting") return <Clock className="size-4 text-warning" />;
  return <CheckCircle2 className="size-4 text-success" />;
}

function RunTrace({ run }: { run: AutomationRun }) {
  const steps = run.steps ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-primary text-sm font-medium">
            {run.contact?.name ?? "Unknown contact"}
            {run.contact?.email && <span className="text-text-muted font-normal"> · {run.contact.email}</span>}
          </p>
          <p className="text-text-muted text-xs">Started {formatRelativeTime(run.createdAt)}</p>
        </div>
        <Badge variant={STATUS_META[run.status].variant}>{STATUS_META[run.status].label}</Badge>
      </div>

      {run.status === "error" && run.detail && (
        <div className="rounded-btn border border-danger/20 bg-red-50 px-3 py-2 text-xs text-danger">{run.detail}</div>
      )}

      {steps.length === 0 ? (
        <p className="text-text-muted text-sm">No steps recorded for this run yet.</p>
      ) : (
        <ol className="space-y-0">
          {steps.map((step, i) => {
            const meta = NODE_DEFINITIONS[step.nodeType];
            const Icon = meta?.icon;
            const isLast = i === steps.length - 1;
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                    {Icon ? <Icon className="size-3.5 text-text-secondary" /> : null}
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn("min-w-0 flex-1", !isLast && "pb-4")}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-text-primary text-sm font-medium">{meta?.label ?? step.nodeType}</p>
                    <StepIcon status={step.status} />
                  </div>
                  {step.detail && <p className="text-text-secondary text-xs mt-0.5">{step.detail}</p>}
                  <p className="text-text-muted text-[11px] mt-0.5">{formatRelativeTime(step.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

interface ExecutionLogViewProps {
  automationId: string;
  enabled: boolean;
}

export function ExecutionLogView({ automationId, enabled }: ExecutionLogViewProps) {
  const { runs, isLoading } = useAutomationRuns(automationId, enabled);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun = runs?.find((r) => r.id === selectedRunId) ?? null;

  if (isLoading) {
    return <p className="text-text-muted text-sm">Loading...</p>;
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center rounded-card border border-border bg-surface-secondary">
        <p className="text-text-muted text-sm">
          No contacts have entered this workflow yet. Once one does, its path through the workflow will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] gap-4 overflow-hidden rounded-card border border-border">
      <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-surface-secondary">
        {runs.map((run) => (
          <button
            key={run.id}
            onClick={() => setSelectedRunId(run.id)}
            className={cn(
              "flex w-full items-start gap-2.5 border-b border-border px-3 py-3 text-left hover:bg-white",
              selectedRunId === run.id && "bg-white",
            )}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <User className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary truncate text-sm font-medium">{run.contact?.name ?? "Unknown contact"}</p>
              <p className="text-text-muted text-xs">{formatRelativeTime(run.createdAt)}</p>
            </div>
            <Badge variant={STATUS_META[run.status].variant}>{STATUS_META[run.status].label}</Badge>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedRun ? (
          <RunTrace run={selectedRun} />
        ) : (
          <p className="text-text-muted text-sm">Select a contact to see its path through the workflow.</p>
        )}
      </div>
    </div>
  );
}
