"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus, X } from "lucide-react";

import { ContactConversationModal } from "@/components/contacts/ContactConversationModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { Textarea } from "@/components/ui/Textarea";
import { type ContactInput, useContactTags, useContacts } from "@/hooks/useContacts";
import { usePermission } from "@/hooks/usePermission";
import type { Contact } from "@/types";

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
  prefill?: Partial<ContactInput>;
  onSaved?: () => void;
}

type FormState = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  additionalEmails: string[];
  phone: string;
  website: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  address: string;
  notes: string;
  tags: string[];
};

function toFormState(source?: Partial<Contact> | Partial<ContactInput>): FormState {
  // Older contacts (created before firstName/lastName existed, or converted
  // from a lead search) only have a single `name` — split it as a best-effort
  // fallback so editing them doesn't show blank name fields.
  const nameParts = (source?.name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: source?.firstName ?? nameParts[0] ?? "",
    lastName: source?.lastName ?? nameParts.slice(1).join(" "),
    company: source?.company ?? "",
    email: source?.email ?? "",
    additionalEmails: source?.additionalEmails ?? [],
    phone: source?.phone ?? "",
    website: source?.website ?? "",
    facebookUrl: source?.facebookUrl ?? "",
    instagramUrl: source?.instagramUrl ?? "",
    linkedinUrl: source?.linkedinUrl ?? "",
    twitterUrl: source?.twitterUrl ?? "",
    address: source?.address ?? "",
    notes: source?.notes ?? "",
    tags: source?.tags ?? [],
  };
}

export function ContactFormModal({ open, onClose, contact, prefill, onSaved }: ContactFormModalProps) {
  const { createContact, updateContact } = useContacts();
  const { tags: tagSuggestions } = useContactTags();
  const [form, setForm] = useState<FormState>(() => toFormState(contact ?? prefill));
  const [assignedToId, setAssignedToId] = useState(contact?.assignedToId ?? "");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const isEditing = !!contact;
  const isSaving = createContact.isPending || updateContact.isPending;
  const canAccessInbox = usePermission("company.email");
  const [conversationOpen, setConversationOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    fetch("/api/users")
      .then((res) => res.json())
      .then((d) => setUsers((d.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
  }, [isEditing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addEmailField() {
    setForm((prev) => ({ ...prev, additionalEmails: [...prev.additionalEmails, ""] }));
  }

  function updateEmailField(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      additionalEmails: prev.additionalEmails.map((e, i) => (i === index ? value : e)),
    }));
  }

  function removeEmailField(index: number) {
    setForm((prev) => ({ ...prev, additionalEmails: prev.additionalEmails.filter((_, i) => i !== index) }));
  }

  function handleClose() {
    setForm(toFormState(contact ?? prefill));
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ");
    if (!name) return;

    const input: ContactInput = {
      name,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      company: form.company.trim() || undefined,
      email: form.email.trim() || undefined,
      additionalEmails: form.additionalEmails.map((e) => e.trim()).filter(Boolean),
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      facebookUrl: form.facebookUrl.trim() || undefined,
      instagramUrl: form.instagramUrl.trim() || undefined,
      linkedinUrl: form.linkedinUrl.trim() || undefined,
      twitterUrl: form.twitterUrl.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      tags: form.tags,
      sourceLeadId: !isEditing ? prefill?.sourceLeadId : undefined,
      assignedToId: isEditing ? assignedToId || null : undefined,
    };

    const onSuccess = {
      onSuccess: () => {
        onSaved?.();
        onClose();
      },
    };

    if (isEditing) {
      updateContact.mutate({ id: contact.id, ...input }, onSuccess);
    } else {
      createContact.mutate(input, onSuccess);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? "Edit Contact" : "Add Contact"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {isEditing && contact.email && canAccessInbox && (
          <div className="flex justify-end -mt-1 -mb-2">
            <button
              type="button"
              onClick={() => setConversationOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline"
            >
              <MessageSquare className="size-3.5" />
              View Conversation
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" required>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Last Name">
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Email">
            <div className="space-y-2">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              {form.additionalEmails.map((email, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmailField(i, e.target.value)}
                    placeholder="Additional email"
                  />
                  <button
                    type="button"
                    onClick={() => removeEmailField(i)}
                    className="text-text-muted hover:text-danger shrink-0"
                    aria-label="Remove email"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addEmailField}
                className="text-brand-primary flex items-center gap-1 text-xs hover:underline"
              >
                <Plus className="size-3" />
                Add another email
              </button>
            </div>
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Facebook">
            <Input value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} />
          </Field>
          <Field label="Instagram">
            <Input value={form.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} />
          </Field>
          <Field label="LinkedIn">
            <Input value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} />
          </Field>
          <Field label="X / Twitter">
            <Input value={form.twitterUrl} onChange={(e) => set("twitterUrl", e.target.value)} />
          </Field>
        </div>

        {isEditing && (
          <Field label="Assigned To">
            <Select value={assignedToId || "__unassigned"} onValueChange={(v) => setAssignedToId(v === "__unassigned" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Tags">
          <TagInput
            tags={form.tags}
            onChange={(tags) => set("tags", tags)}
            placeholder="Type a tag and press Enter"
            suggestions={tagSuggestions}
          />
        </Field>

        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} disabled={!form.firstName.trim() && !form.lastName.trim()}>
            {isEditing ? "Save Changes" : "Add Contact"}
          </Button>
        </div>
      </form>
      {isEditing && contact.email && (
        <ContactConversationModal
          open={conversationOpen}
          onClose={() => setConversationOpen(false)}
          contactEmail={contact.email}
          contactName={contact.name}
        />
      )}
    </Modal>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-text-secondary text-xs font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
        {hint && <span className="text-text-muted font-normal"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}
