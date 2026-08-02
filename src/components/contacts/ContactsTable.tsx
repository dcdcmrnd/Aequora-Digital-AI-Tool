"use client";

import { useState } from "react";
import { ExternalLink, MessageSquare, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { ContactConversationModal } from "@/components/contacts/ContactConversationModal";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { useContacts } from "@/hooks/useContacts";
import { usePermission } from "@/hooks/usePermission";
import type { Contact } from "@/types";

interface ContactsTableProps {
  contacts: Contact[];
  canManage: boolean;
}

export function ContactsTable({ contacts, canManage }: ContactsTableProps) {
  const { deleteContact } = useContacts();
  const [editing, setEditing] = useState<Contact | null>(null);
  const [conversationContact, setConversationContact] = useState<Contact | null>(null);
  const canAccessInbox = usePermission("company.email");

  function handleDelete(contact: Contact) {
    if (!confirm(`Delete contact "${contact.name}"?`)) return;
    deleteContact.mutate(contact.id);
  }

  const socialLinksFor = (contact: Contact) =>
    [
      { href: contact.facebookUrl, label: "Facebook" },
      { href: contact.instagramUrl, label: "Instagram" },
      { href: contact.linkedinUrl, label: "LinkedIn" },
      { href: contact.twitterUrl, label: "X / Twitter" },
    ].filter((s) => s.href);

  return (
    <div className="rounded-card border-border overflow-x-auto border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Social</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const socialLinks = socialLinksFor(contact);
            return (
              <TableRow key={contact.id}>
                <TableCell>
                  <p className="text-text-primary font-medium">{contact.name}</p>
                  {contact.company && <p className="text-text-muted text-xs">{contact.company}</p>}
                </TableCell>
                <TableCell>
                  {contact.email ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-primary">{contact.email}</span>
                      <CopyButton value={contact.email} label="Email" />
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.phone ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-primary">{contact.phone}</span>
                      <CopyButton value={contact.phone} label="Phone" />
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="muted">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {socialLinks.length > 0 ? (
                    <div className="flex gap-2">
                      {socialLinks.map((s) => (
                        <a
                          key={s.label}
                          href={s.href!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={s.label}
                          className="text-text-muted hover:text-brand-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {contact.email && canAccessInbox && (
                        <button
                          onClick={() => setConversationContact(contact)}
                          className="text-text-muted hover:text-brand-primary"
                          aria-label="View conversation"
                          title="View conversation"
                        >
                          <MessageSquare className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(contact)}
                        className="text-text-muted hover:text-brand-primary"
                        aria-label="Edit contact"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact)}
                        className="text-text-muted hover:text-danger"
                        aria-label="Delete contact"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {editing && <ContactFormModal open={!!editing} onClose={() => setEditing(null)} contact={editing} />}
      {conversationContact?.email && (
        <ContactConversationModal
          open={!!conversationContact}
          onClose={() => setConversationContact(null)}
          contactEmail={conversationContact.email}
          contactName={conversationContact.name}
        />
      )}
    </div>
  );
}
