"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Search, User, XCircle } from "lucide-react";

import { NODE_DEFINITIONS } from "@/lib/automation/nodeRegistry";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useAutomationRuns } from "@/hooks/useAutomations";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { AutomationRun, AutomationRunStep } from "@/types";

const PAGE_SIZE = 15;

const STATUS_META: Record<AutomationRun["status"], { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  running: { label: "Running", variant: "muted" },
  waiting: { label: "Waiting", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  error: { label: "Error", variant: "danger" },
  cancelled: { label: "Removed", variant: "muted" },
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const selectedRun = runs?.find((r) => r.id === selectedRunId) ?? null;

  const filteredRuns = (runs ?? []).filter((run) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (run.contact?.name?.toLowerCase().includes(q) ?? false) || (run.contact?.email?.toLowerCase().includes(q) ?? false);
  });
  const pageCount = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const pageRuns = filteredRuns.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // A new search (or the run list itself changing size) can leave `page`
  // past the new last page -- snap back instead of showing a blank list.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    setPage(0);
  }, [search]);

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
      <div className="flex w-72 shrink-0 flex-col border-r border-border bg-surface-secondary">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="text-text-muted pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pageRuns.length === 0 ? (
            <p className="text-text-muted p-4 text-center text-xs">No contacts match &quot;{search}&quot;.</p>
          ) : (
            pageRuns.map((run) => (
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
            ))
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-text-muted text-[11px]">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
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
