"use client";

import { useState } from "react";
import { ExternalLink, Mail, MapPin, Phone, Pencil, Trash2, Globe } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { useContacts } from "@/hooks/useContacts";
import type { Contact } from "@/types";

interface ContactCardProps {
  contact: Contact;
  canManage: boolean;
}

export function ContactCard({ contact, canManage }: ContactCardProps) {
  const { deleteContact } = useContacts();
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    if (!confirm(`Delete contact "${contact.name}"?`)) return;
    deleteContact.mutate(contact.id);
  }

  const socialLinks: { href: string | null; label: string }[] = [
    { href: contact.facebookUrl, label: "Facebook" },
    { href: contact.instagramUrl, label: "Instagram" },
    { href: contact.linkedinUrl, label: "LinkedIn" },
    { href: contact.twitterUrl, label: "X / Twitter" },
  ];

  return (
    <div className="rounded-card border-border flex flex-col gap-3 border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-text-primary truncate text-sm font-semibold">{contact.name}</p>
          {contact.company && <p className="text-text-muted truncate text-xs">{contact.company}</p>}
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-text-muted hover:text-brand-primary transition-colors"
              aria-label="Edit contact"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="text-text-muted hover:text-danger transition-colors"
              aria-label="Delete contact"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="text-text-muted size-3.5 shrink-0" />
            <span className="text-text-primary truncate">{contact.phone}</span>
            <CopyButton value={contact.phone} label="Phone" />
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="text-text-muted size-3.5 shrink-0" />
            <span className="text-text-primary truncate">{contact.email}</span>
            <CopyButton value={contact.email} label="Email" />
          </div>
        )}
        {contact.website && (
          <div className="flex items-center gap-2">
            <Globe className="text-text-muted size-3.5 shrink-0" />
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary truncate hover:underline"
            >
              {contact.website}
            </a>
            <CopyButton value={contact.website} label="Website" />
          </div>
        )}
        {contact.address && (
          <div className="flex items-center gap-2">
            <MapPin className="text-text-muted size-3.5 shrink-0" />
            <span className="text-text-primary truncate">{contact.address}</span>
            <CopyButton value={contact.address} label="Address" />
          </div>
        )}
      </div>

      {socialLinks.some((s) => s.href) && (
        <div className="flex gap-2">
          {socialLinks.map(
            ({ href, label }) =>
              href && (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-brand-primary inline-flex items-center gap-1 text-xs transition-colors"
                  aria-label={label}
                  title={label}
                >
                  <ExternalLink className="size-3.5" />
                  {label}
                </a>
              ),
          )}
        </div>
      )}

      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.tags.map((tag) => (
            <Badge key={tag} variant="muted">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {contact.notes && <p className="text-text-secondary line-clamp-2 text-xs">{contact.notes}</p>}

      {editing && <ContactFormModal open={editing} onClose={() => setEditing(false)} contact={contact} />}
    </div>
  );
}
