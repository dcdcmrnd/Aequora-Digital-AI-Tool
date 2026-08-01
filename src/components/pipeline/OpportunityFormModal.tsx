"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useContacts } from "@/hooks/useContacts";
import { useOpportunities } from "@/hooks/useOpportunities";
import type { Opportunity, Pipeline } from "@/types";

interface OpportunityFormModalProps {
  open: boolean;
  onClose: () => void;
  pipeline: Pipeline;
  opportunity?: Opportunity;
  defaultStageId?: string;
}

export function OpportunityFormModal({ open, onClose, pipeline, opportunity, defaultStageId }: OpportunityFormModalProps) {
  const { contacts } = useContacts();
  const { createOpportunity, updateOpportunity, deleteOpportunity } = useOpportunities();
  const isEditing = !!opportunity;

  const [name, setName] = useState(opportunity?.name ?? "");
  const [value, setValue] = useState(opportunity?.value?.toString() ?? "");
  const [contactId, setContactId] = useState(opportunity?.contactId ?? "");
  const [stageId, setStageId] = useState(opportunity?.stageId ?? defaultStageId ?? pipeline.stages[0]?.id ?? "");
  const [notes, setNotes] = useState(opportunity?.notes ?? "");

  const isSaving = createOpportunity.isPending || updateOpportunity.isPending;

  function handleClose() {
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !contactId) return;

    const parsedValue = value.trim() ? Number(value) : undefined;
    const onSuccess = { onSuccess: () => onClose() };

    if (isEditing) {
      updateOpportunity.mutate(
        { id: opportunity.id, name: name.trim(), value: parsedValue ?? null, stageId, notes: notes.trim() || null },
        onSuccess,
      );
    } else {
      createOpportunity.mutate(
        {
          name: name.trim(),
          value: parsedValue,
          contactId,
          pipelineId: pipeline.id,
          stageId,
          notes: notes.trim() || undefined,
        },
        onSuccess,
      );
    }
  }

  function handleDelete() {
    if (!opportunity) return;
    if (!confirm(`Delete opportunity "${opportunity.name}"?`)) return;
    deleteOpportunity.mutate(opportunity.id, { onSuccess: () => onClose() });
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? "Edit Opportunity" : "Add Opportunity"} size="md">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">
            Name<span className="text-danger"> *</span>
          </span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">
            Contact<span className="text-danger"> *</span>
          </span>
          <Select value={contactId} onValueChange={setContactId} disabled={isEditing}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a contact" />
            </SelectTrigger>
            <SelectContent>
              {(contacts ?? []).map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.company && ` · ${contact.company}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-text-secondary text-xs font-medium">Value ($)</span>
            <Input type="number" min={0} step={100} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>

          <label className="block space-y-1">
            <span className="text-text-secondary text-xs font-medium">Stage</span>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipeline.stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Notes</span>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="flex items-center justify-between pt-2">
          {isEditing ? (
            <Button type="button" variant="ghost" className="text-danger" onClick={handleDelete}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSaving} disabled={!name.trim() || !contactId}>
              {isEditing ? "Save Changes" : "Add Opportunity"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
