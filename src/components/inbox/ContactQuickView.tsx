"use client";

import { useState } from "react";
import { Briefcase, Mail, Pencil, Phone, PhoneCall, Workflow, X } from "lucide-react";

import { BulkWorkflowModal } from "@/components/contacts/BulkActionsBar";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { CallButton } from "@/components/calls/CallWidget";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { useContact, useContactCalls, useContactTags, useContacts } from "@/hooks/useContacts";
import { formatRelativeTime } from "@/lib/utils";

const CALL_STATUS_LABEL: Record<string, string> = {
  "queued": "Queued",
  "ringing": "Ringing",
  "in-progress": "In progress",
  "completed": "Completed",
  "failed": "Failed",
  "busy": "Busy",
  "no-answer": "No answer",
  "canceled": "Canceled",
};

function formatCallDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ContactQuickViewProps {
  contactId: string;
  onClose: () => void;
}

/**
 * A GoHighLevel-style side panel: lets someone reading a conversation see and
 * manage the other party's CRM record (tags, workflow enrollment, full
 * profile) without leaving the thread.
 */
export function ContactQuickView({ contactId, onClose }: ContactQuickViewProps) {
  const { contact, isLoading } = useContact(contactId);
  const { calls } = useContactCalls(contactId);
  const { updateContact } = useContacts();
  const { tags: tagSuggestions } = useContactTags();
  const [editOpen, setEditOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  function handleTagsChange(tags: string[]) {
    updateContact.mutate({ id: contactId, tags });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-border bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">Contact</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading...</p>
        ) : !contact ? (
          <p className="text-text-muted text-sm">Contact not found.</p>
        ) : (
          <>
            <div>
              <p className="text-text-primary text-base font-semibold">{contact.name}</p>
              {contact.company && <p className="text-text-muted text-xs">{contact.company}</p>}
            </div>

            <div className="space-y-1.5 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone className="size-3.5 shrink-0" />
                  <span>{contact.phone}</span>
                  <CallButton contactId={contact.id} name={contact.name} phone={contact.phone} />
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Briefcase className="size-3.5 shrink-0" />
                  <span>{contact.company}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-text-secondary mb-1 text-xs font-medium">Tags</p>
              <TagInput
                tags={contact.tags}
                onChange={handleTagsChange}
                placeholder="Type a tag and press Enter"
                suggestions={tagSuggestions}
              />
            </div>

            {calls.length > 0 && (
              <div>
                <p className="text-text-secondary mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <PhoneCall className="size-3.5" />
                  Call History
                </p>
                <div className="space-y-2">
                  {calls.map((call) => (
                    <div key={call.id} className="rounded-input border border-border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-primary font-medium">
                          {CALL_STATUS_LABEL[call.status] ?? call.status}
                        </span>
                        <span className="text-text-muted">{formatRelativeTime(call.createdAt)}</span>
                      </div>
                      <div className="text-text-muted mt-0.5 flex items-center gap-2">
                        <span>{call.user.name}</span>
                        {call.durationSec !== null && <span>{formatCallDuration(call.durationSec)}</span>}
                      </div>
                      {call.recordingSid && (
                        <audio controls preload="none" className="mt-1.5 h-8 w-full" src={`/api/calls/${call.id}/recording`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setWorkflowOpen(true)}>
                <Workflow className="size-3.5" />
                Add to Workflow
              </Button>
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" />
                Edit Profile
              </Button>
            </div>
          </>
        )}
      </div>

      {contact && editOpen && <ContactFormModal open={editOpen} onClose={() => setEditOpen(false)} contact={contact} />}
      {contact && workflowOpen && (
        <BulkWorkflowModal
          selectedIds={[contact.id]}
          onClose={() => setWorkflowOpen(false)}
          onDone={() => setWorkflowOpen(false)}
        />
      )}
    </div>
  );
}
