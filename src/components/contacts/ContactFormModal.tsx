"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { type ContactInput, useContacts } from "@/hooks/useContacts";
import type { Contact } from "@/types";

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
  prefill?: Partial<ContactInput>;
  onSaved?: () => void;
}

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  address: string;
  notes: string;
  tags: string;
};

function toFormState(source?: Partial<Contact> | Partial<ContactInput>): FormState {
  return {
    name: source?.name ?? "",
    company: source?.company ?? "",
    email: source?.email ?? "",
    phone: source?.phone ?? "",
    website: source?.website ?? "",
    facebookUrl: source?.facebookUrl ?? "",
    instagramUrl: source?.instagramUrl ?? "",
    linkedinUrl: source?.linkedinUrl ?? "",
    twitterUrl: source?.twitterUrl ?? "",
    address: source?.address ?? "",
    notes: source?.notes ?? "",
    tags: (source?.tags ?? []).join(", "),
  };
}

export function ContactFormModal({ open, onClose, contact, prefill, onSaved }: ContactFormModalProps) {
  const { createContact, updateContact } = useContacts();
  const [form, setForm] = useState<FormState>(() => toFormState(contact ?? prefill));
  const isEditing = !!contact;
  const isSaving = createContact.isPending || updateContact.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(toFormState(contact ?? prefill));
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const input: ContactInput = {
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      facebookUrl: form.facebookUrl.trim() || undefined,
      instagramUrl: form.instagramUrl.trim() || undefined,
      linkedinUrl: form.linkedinUrl.trim() || undefined,
      twitterUrl: form.twitterUrl.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sourceLeadId: !isEditing ? prefill?.sourceLeadId : undefined,
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
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

        <Field label="Tags" hint="Comma-separated">
          <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="client, hot lead" />
        </Field>

        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} disabled={!form.name.trim()}>
            {isEditing ? "Save Changes" : "Add Contact"}
          </Button>
        </div>
      </form>
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
