"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Paperclip, Pencil, PhoneCall, Reply, Search, Workflow } from "lucide-react";
import toast from "react-hot-toast";

import { BulkWorkflowModal } from "@/components/contacts/BulkActionsBar";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { CallButton } from "@/components/calls/CallWidget";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { useContact, useContactTags, useContacts } from "@/hooks/useContacts";
import { useContactAutomationRuns, useContactTimeline, type TimelineItem } from "@/hooks/useConversations";
import { CALL_STATUS_LABEL, formatCallDuration } from "@/lib/calls";
import { cn, formatRelativeTime } from "@/lib/utils";

interface ThreadContact {
  id: string;
  name: string;
  email: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const RUN_STATUS_LABEL: Record<string, string> = {
  running: "Running",
  waiting: "Waiting",
  completed: "Completed",
  error: "Error",
};

export function ConversationsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlContactId = searchParams.get("contactId");

  const [contacts, setContacts] = useState<ThreadContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(urlContactId);
  const [replyOpen, setReplyOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  // Column 1: distinct contacts from the most recent agency threads, newest
  // conversation first (Gmail's own thread order). A brand-new contact with
  // no messages yet still opens fine via the URL -- it just won't be in
  // this list until a conversation actually starts.
  useEffect(() => {
    setLoadingContacts(true);
    fetch(`/api/gmail/threads?${new URLSearchParams({ scope: "agency", label: "INBOX" })}`)
      .then((res) => res.json())
      .then((data) => {
        const threads = Array.isArray(data.threads) ? data.threads : [];
        const seen = new Set<string>();
        const list: ThreadContact[] = [];
        for (const t of threads) {
          if (!t.contactId || seen.has(t.contactId)) continue;
          seen.add(t.contactId);
          list.push({ id: t.contactId, name: t.contactName, email: t.contactEmail });
        }
        setContacts(list);
      })
      .catch(() => toast.error("Couldn't load conversations."))
      .finally(() => setLoadingContacts(false));
  }, []);

  useEffect(() => {
    if (urlContactId) setSelectedId(urlContactId);
  }, [urlContactId]);

  function selectContact(id: string) {
    setSelectedId(id);
    router.replace(`/conversations?contactId=${id}`, { scroll: false });
  }

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [contacts, search]);

  const { contact, isLoading: contactLoading } = useContact(selectedId);
  const { items, isLoading: timelineLoading, refetch: refetchTimeline } = useContactTimeline(selectedId);
  const { runs } = useContactAutomationRuns(selectedId);
  const { updateContact } = useContacts();
  const { tags: tagSuggestions } = useContactTags();

  const lastEmail = [...items].reverse().find((i): i is Extract<TimelineItem, { type: "email" }> => i.type === "email");

  function handleTagsChange(tags: string[]) {
    if (!contact) return;
    updateContact.mutate({ id: contact.id, tags });
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-card border border-border bg-white">
      {/* Column 1: contacts */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <Link href="/contacts" className="text-text-muted hover:text-text-primary mb-2 flex items-center gap-1 text-xs">
            <ArrowLeft className="size-3.5" />
            Contacts
          </Link>
          <div className="relative">
            <Search className="text-text-muted pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="border-border w-full rounded-input border py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <p className="text-text-muted p-4 text-center text-sm">Loading...</p>
          ) : filteredContacts.length === 0 ? (
            <p className="text-text-muted p-4 text-center text-sm">No conversations yet.</p>
          ) : (
            filteredContacts.map((c) => (
              <button
                key={c.id}
                onClick={() => selectContact(c.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary",
                  selectedId === c.id && "bg-brand-primary/5",
                )}
              >
                <Avatar name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-medium">{c.name}</p>
                  <p className="text-text-muted truncate text-xs">{c.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Column 2: conversation */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-text-muted text-sm">Select a conversation to view it</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-text-primary text-sm font-semibold">{contact?.name ?? "..."}</p>
                {contact?.company && <p className="text-text-muted text-xs">{contact.company}</p>}
              </div>
              {contact?.phone && <CallButton contactId={contact.id} name={contact.name} phone={contact.phone} />}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-surface-secondary/40 p-4">
              {timelineLoading ? (
                <p className="text-text-muted text-center text-sm">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-text-muted p-6 text-center text-sm">No conversation yet — send an email to get started.</p>
              ) : (
                items.map((item) =>
                  item.type === "email" ? (
                    <div key={item.id} className={cn("flex", item.isOutgoing ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-card px-3.5 py-2.5 text-sm shadow-sm",
                          item.isOutgoing ? "bg-brand-primary text-white" : "border border-border bg-white text-text-primary",
                        )}
                      >
                        {item.subject && (
                          <p className={cn("mb-1 text-xs font-semibold", item.isOutgoing ? "text-white/80" : "text-text-muted")}>
                            {item.subject}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap">{stripHtml(item.html) || item.text}</p>
                        <p className={cn("mt-1.5 text-[11px]", item.isOutgoing ? "text-white/70" : "text-text-muted")}>
                          {formatRelativeTime(item.date)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={item.id} className="flex justify-center">
                      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-text-secondary">
                        <PhoneCall className="size-3 text-brand-primary" />
                        <span>
                          {CALL_STATUS_LABEL[item.status] ?? item.status}
                          {item.durationSec !== null && ` · ${formatCallDuration(item.durationSec)}`} · {item.userName}
                        </span>
                        {item.recordingSid && (
                          <audio controls preload="none" className="h-6 w-40" src={`/api/calls/${item.id}/recording`} />
                        )}
                        <span className="text-text-muted">{formatRelativeTime(item.date)}</span>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              <button
                onClick={() => (lastEmail ? setReplyOpen(true) : setComposeOpen(true))}
                className="border-border text-text-muted hover:border-brand-primary hover:text-text-primary bg-white flex-1 rounded-full border px-4 py-2.5 text-left text-sm transition-colors"
              >
                {lastEmail ? `Reply to ${contact?.name ?? "contact"}…` : `Email ${contact?.name ?? "contact"}…`}
              </button>
              {lastEmail && (
                <Button size="sm" variant="ghost" onClick={() => setComposeOpen(true)} title="New email (not a reply)">
                  <Paperclip className="size-3.5" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Column 3: contact detail */}
      {selectedId && (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border p-4">
          {contactLoading || !contact ? (
            <p className="text-text-muted text-sm">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-text-primary text-base font-semibold">{contact.name}</p>
                {contact.email && <p className="text-text-muted text-xs">{contact.email}</p>}
                {contact.phone && <p className="text-text-muted text-xs">{contact.phone}</p>}
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setWorkflowOpen(true)}>
                  <Workflow className="size-3.5" />
                  Workflow
                </Button>
              </div>

              <div>
                <p className="text-text-secondary mb-1 text-xs font-medium">Tags</p>
                <TagInput tags={contact.tags} onChange={handleTagsChange} placeholder="Add a tag..." suggestions={tagSuggestions} />
              </div>

              <AssigneePicker contactId={contact.id} assignedToId={contact.assignedToId ?? null} />

              {runs.length > 0 && (
                <div>
                  <p className="text-text-secondary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                    <Workflow className="size-3.5" />
                    Workflows
                  </p>
                  <div className="space-y-1.5">
                    {runs.map((r) => (
                      <div key={r.id} className="rounded-input border border-border p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-text-primary font-medium">{r.automationName}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              r.status === "error"
                                ? "bg-red-50 text-danger"
                                : r.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-blue-50 text-blue-700",
                            )}
                          >
                            {RUN_STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </div>
                        <p className="text-text-muted mt-0.5">Started {formatRelativeTime(r.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <NotesEditor contactId={contact.id} initialNotes={contact.notes ?? ""} />
            </div>
          )}
        </div>
      )}

      {contact && editOpen && <ContactFormModal open={editOpen} onClose={() => setEditOpen(false)} contact={contact} />}
      {contact && workflowOpen && (
        <BulkWorkflowModal selectedIds={[contact.id]} onClose={() => setWorkflowOpen(false)} onDone={() => setWorkflowOpen(false)} />
      )}
      {contact && lastEmail && (
        <ComposeModal
          open={replyOpen}
          onClose={() => {
            setReplyOpen(false);
            refetchTimeline();
          }}
          mode="reply"
          scope="agency"
          defaultTo={lastEmail.isOutgoing ? lastEmail.to : lastEmail.from}
          defaultSubject={lastEmail.subject.startsWith("Re:") ? lastEmail.subject : `Re: ${lastEmail.subject}`}
          threadId={lastEmail.threadId}
          inReplyTo={lastEmail.id}
          references={lastEmail.id}
        />
      )}
      {contact?.email && (
        <ComposeModal
          open={composeOpen}
          onClose={() => {
            setComposeOpen(false);
            refetchTimeline();
          }}
          mode="compose"
          scope="agency"
          defaultTo={contact.email}
        />
      )}
    </div>
  );
}

function AssigneePicker({ contactId, assignedToId }: { contactId: string; assignedToId: string | null }) {
  const { updateContact } = useContacts();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((d) => setUsers((d.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
  }, []);

  return (
    <div>
      <p className="text-text-secondary mb-1 text-xs font-medium">Assigned To</p>
      <select
        value={assignedToId ?? ""}
        onChange={(e) => updateContact.mutate({ id: contactId, assignedToId: e.target.value || null })}
        className="border-border w-full rounded-input border px-2.5 py-1.5 text-sm"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function NotesEditor({ contactId, initialNotes }: { contactId: string; initialNotes: string }) {
  const { updateContact } = useContacts();
  const [notes, setNotes] = useState(initialNotes);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
    setDirty(false);
  }, [initialNotes]);

  return (
    <div>
      <p className="text-text-secondary mb-1 text-xs font-medium">Notes</p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setDirty(true);
        }}
        rows={4}
        placeholder="Add a note about this contact..."
        className="border-border w-full rounded-input border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
      />
      {dirty && (
        <Button
          size="sm"
          className="mt-1.5"
          onClick={() => {
            updateContact.mutate({ id: contactId, notes });
            setDirty(false);
          }}
        >
          Save Note
        </Button>
      )}
    </div>
  );
}
