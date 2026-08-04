"use client";

import { User, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useNodeContacts, useRunAction } from "@/hooks/useAutomations";

interface NodeContactsPanelProps {
  automationId: string;
  nodeId: string;
  nodeLabel: string;
  onClose: () => void;
}

export function NodeContactsPanel({ automationId, nodeId, nodeLabel, onClose }: NodeContactsPanelProps) {
  const { runs, isLoading } = useNodeContacts(automationId, nodeId);
  const runAction = useRunAction(automationId);

  function handleRemove(runId: string) {
    if (!confirm("Remove this contact from the workflow? This can't be undone.")) return;
    runAction.mutate({ runId, action: "remove" });
  }

  function handleAdvance(runId: string) {
    runAction.mutate({ runId, action: "advance" });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-border bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-text-primary text-sm font-semibold">{nodeLabel}</h3>
          <p className="text-text-muted text-xs">Contacts currently at this step</p>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading...</p>
        ) : !runs || runs.length === 0 ? (
          <p className="text-text-muted text-sm">No contacts are currently at this step.</p>
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li key={run.id} className="rounded-card border border-border p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary truncate text-sm font-medium">{run.contact?.name ?? "Unknown contact"}</p>
                    {run.contact?.email && <p className="text-text-muted truncate text-xs">{run.contact.email}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    disabled={runAction.isPending}
                    onClick={() => handleAdvance(run.id)}
                  >
                    Push to Next Step
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-danger hover:text-danger"
                    disabled={runAction.isPending}
                    onClick={() => handleRemove(run.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
