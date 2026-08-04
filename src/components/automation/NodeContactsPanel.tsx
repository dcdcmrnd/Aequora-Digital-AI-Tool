"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, User, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useBulkRunAction, useNodeContacts } from "@/hooks/useAutomations";

const PAGE_SIZE = 15;

interface NodeContactsPanelProps {
  automationId: string;
  nodeId: string;
  nodeLabel: string;
  onClose: () => void;
}

export function NodeContactsPanel({ automationId, nodeId, nodeLabel, onClose }: NodeContactsPanelProps) {
  const { runs, isLoading } = useNodeContacts(automationId, nodeId);
  const bulkAction = useBulkRunAction(automationId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // A fresh fetch (e.g. after an action clears some runs off this node) can
  // leave `page` past the new last page -- snap back instead of showing blank.
  useEffect(() => {
    if (!runs) return;
    const maxPage = Math.max(0, Math.ceil(runs.length / PAGE_SIZE) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [runs, page]);

  const pageCount = runs ? Math.max(1, Math.ceil(runs.length / PAGE_SIZE)) : 1;
  const pageRuns = runs?.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) ?? [];
  const pageAllSelected = pageRuns.length > 0 && pageRuns.every((r) => selectedIds.has(r.id));

  function toggleOne(runId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  function togglePageAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) pageRuns.forEach((r) => next.delete(r.id));
      else pageRuns.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function handleBulk(action: "remove" | "advance") {
    if (selectedIds.size === 0) return;
    if (action === "remove" && !confirm(`Remove ${selectedIds.size} contact${selectedIds.size === 1 ? "" : "s"} from the workflow? This can't be undone.`)) {
      return;
    }
    bulkAction.mutate({ runIds: Array.from(selectedIds), action }, { onSuccess: () => setSelectedIds(new Set()) });
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

      {runs && runs.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <label className="flex items-center gap-2 text-xs text-text-secondary select-none">
            <input
              type="checkbox"
              checked={pageAllSelected}
              onChange={togglePageAll}
              className="size-3.5 rounded border-border text-brand-primary focus:ring-brand-primary"
            />
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select this page"}
          </label>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
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
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading...</p>
        ) : !runs || runs.length === 0 ? (
          <p className="text-text-muted text-sm">No contacts are currently at this step.</p>
        ) : (
          <ul className="space-y-2">
            {pageRuns.map((run) => (
              <li key={run.id} className="flex items-center gap-2.5 rounded-card border border-border p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(run.id)}
                  onChange={() => toggleOne(run.id)}
                  className="size-3.5 shrink-0 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <User className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-medium">{run.contact?.name ?? "Unknown contact"}</p>
                  {run.contact?.email && <p className="text-text-muted truncate text-xs">{run.contact.email}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {runs && runs.length > 0 && (
        <div className="flex gap-2 border-t border-border p-4">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={selectedIds.size === 0 || bulkAction.isPending}
            onClick={() => handleBulk("advance")}
          >
            Push to Next Step{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-danger hover:text-danger"
            disabled={selectedIds.size === 0 || bulkAction.isPending}
            onClick={() => handleBulk("remove")}
          >
            Remove{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
