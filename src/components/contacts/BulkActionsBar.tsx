"use client";

import { useState } from "react";
import { GitBranch, Pencil, Tag, Trash2, Workflow, X } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { Textarea } from "@/components/ui/Textarea";
import { useAutomations } from "@/hooks/useAutomations";
import { useContactTags } from "@/hooks/useContacts";
import { usePipeline } from "@/hooks/usePipeline";
import { apiFetch, ApiError } from "@/lib/api-client";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void;
}

type ModalKind = "tag" | "pipeline" | "workflow" | "update" | null;

export function BulkActionsBar({ selectedIds, onClear, onDone }: BulkActionsBarProps) {
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setSubmitting(true);
    try {
      const result = await apiFetch<{ deleted: number }>("/api/contacts/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ contactIds: selectedIds }),
      });
      toast.success(`Deleted ${result.deleted} contact${result.deleted === 1 ? "" : "s"}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete contacts");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="border-brand-primary bg-brand-primary/5 sticky top-0 z-10 flex items-center gap-3 rounded-card border px-4 py-2.5">
        <span className="text-text-primary text-sm font-medium">{selectedIds.length} selected</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOpenModal("workflow")}>
            <Workflow className="size-3.5" />
            Add to Workflow
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpenModal("tag")}>
            <Tag className="size-3.5" />
            Add Tags
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpenModal("pipeline")}>
            <GitBranch className="size-3.5" />
            Add to Pipeline
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpenModal("update")}>
            <Pencil className="size-3.5" />
            Bulk Update
          </Button>
          <Button size="sm" variant="secondary" className="text-danger" onClick={handleDelete} loading={submitting}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <button onClick={onClear} className="text-text-muted hover:text-text-primary ml-1" aria-label="Clear selection">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {openModal === "tag" && (
        <BulkTagModal selectedIds={selectedIds} onClose={() => setOpenModal(null)} onDone={onDone} />
      )}
      {openModal === "pipeline" && (
        <BulkPipelineModal selectedIds={selectedIds} onClose={() => setOpenModal(null)} onDone={onDone} />
      )}
      {openModal === "workflow" && (
        <BulkWorkflowModal selectedIds={selectedIds} onClose={() => setOpenModal(null)} onDone={onDone} />
      )}
      {openModal === "update" && (
        <BulkUpdateModal selectedIds={selectedIds} onClose={() => setOpenModal(null)} onDone={onDone} />
      )}
    </>
  );
}

function BulkTagModal({ selectedIds, onClose, onDone }: { selectedIds: string[]; onClose: () => void; onDone: () => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { tags: tagSuggestions } = useContactTags();

  async function handleApply() {
    if (tags.length === 0) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ updated: number }>("/api/contacts/bulk-tag", {
        method: "POST",
        body: JSON.stringify({ contactIds: selectedIds, tags }),
      });
      toast.success(`Tagged ${result.updated} contact${result.updated === 1 ? "" : "s"}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add Tags to ${selectedIds.length} Contact${selectedIds.length === 1 ? "" : "s"}`}>
      <div className="space-y-4 p-6">
        <TagInput tags={tags} onChange={setTags} placeholder="Type a tag and press Enter" suggestions={tagSuggestions} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} loading={saving} disabled={tags.length === 0}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkPipelineModal({ selectedIds, onClose, onDone }: { selectedIds: string[]; onClose: () => void; onDone: () => void }) {
  const { pipeline } = usePipeline();
  const [stageId, setStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const stages = pipeline?.stages ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];

  async function handleApply() {
    if (!stageId || !pipeline) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ created: number }>("/api/contacts/bulk-pipeline", {
        method: "POST",
        body: JSON.stringify({ contactIds: selectedIds, pipelineId: pipeline.id, stageId }),
      });
      toast.success(`Added ${result.created} opportunit${result.created === 1 ? "y" : "ies"} to the pipeline`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add to pipeline");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add ${selectedIds.length} Contact${selectedIds.length === 1 ? "" : "s"} to Pipeline`}>
      <div className="space-y-4 p-6">
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Stage</span>
          <Select value={stageId} onValueChange={setStageId}>
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
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} loading={saving} disabled={!stageId}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkWorkflowModal({ selectedIds, onClose, onDone }: { selectedIds: string[]; onClose: () => void; onDone: () => void }) {
  const { automations } = useAutomations();
  const [automationId, setAutomationId] = useState("");
  const [saving, setSaving] = useState(false);
  const activeAutomations = (automations ?? []).filter((a) => a.isActive);

  async function handleApply() {
    if (!automationId) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ enrolled: number; skipped: number }>("/api/contacts/bulk-enroll", {
        method: "POST",
        body: JSON.stringify({ contactIds: selectedIds, automationId }),
      });
      const skippedNote = result.skipped > 0 ? `, ${result.skipped} already in progress` : "";
      toast.success(`Added ${result.enrolled} contact${result.enrolled === 1 ? "" : "s"} to the workflow${skippedNote}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add to workflow");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add ${selectedIds.length} Contact${selectedIds.length === 1 ? "" : "s"} to a Workflow`}>
      <div className="space-y-4 p-6">
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Workflow</span>
          <Select value={automationId} onValueChange={setAutomationId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a workflow" />
            </SelectTrigger>
            <SelectContent>
              {activeAutomations.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <p className="text-text-muted text-xs">
          Skips this automation's trigger and starts each contact directly at the first action.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} loading={saving} disabled={!automationId}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkUpdateModal({ selectedIds, onClose, onDone }: { selectedIds: string[]; onClose: () => void; onDone: () => void }) {
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = !!(company.trim() || website.trim() || notes.trim());

  async function handleApply() {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ updated: number }>("/api/contacts/bulk-update", {
        method: "POST",
        body: JSON.stringify({ contactIds: selectedIds, company, website, notes }),
      });
      toast.success(`Updated ${result.updated} contact${result.updated === 1 ? "" : "s"}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update contacts");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Bulk Update ${selectedIds.length} Contact${selectedIds.length === 1 ? "" : "s"}`}>
      <div className="space-y-4 p-6">
        <p className="text-text-muted text-xs">Only fields you fill in will be applied — blank fields are left unchanged.</p>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Company</span>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Website</span>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Notes</span>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} loading={saving} disabled={!hasChanges}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
