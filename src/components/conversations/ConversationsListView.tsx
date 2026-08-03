"use client";

import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";

import { ContactConversationModal } from "@/components/contacts/ContactConversationModal";
import { Input } from "@/components/ui/Input";
import { useContacts } from "@/hooks/useContacts";
import type { Contact } from "@/types";

export function ConversationsListView() {
  const { contacts, isLoading } = useContacts();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const withEmail = (contacts ?? []).filter((c) => !!c.email);
    const q = search.trim().toLowerCase();
    if (!q) return withEmail;
    return withEmail.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="text-text-muted text-sm">Browse each contact's email history, separate from the shared team Inbox.</p>
      </div>

      <Input
        placeholder="Search by name, company, or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : filtered.length > 0 ? (
        <div className="rounded-card border-border overflow-hidden border bg-white">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setActive(contact)}
              className="hover:bg-surface-secondary flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <MessageSquare className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-medium">{contact.name}</p>
                <p className="text-text-muted truncate text-xs">
                  {contact.email}
                  {contact.company && ` · ${contact.company}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm">
          {search ? `No contacts match "${search}".` : "No contacts with an email address yet."}
        </p>
      )}

      {active?.email && (
        <ContactConversationModal
          open={!!active}
          onClose={() => setActive(null)}
          contactEmail={active.email}
          contactName={active.name}
        />
      )}
    </div>
  );
}
