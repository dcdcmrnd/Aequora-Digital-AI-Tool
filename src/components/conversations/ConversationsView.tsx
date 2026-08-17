"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Pencil, PhoneCall, Reply, Search, Workflow } from "lucide-react";
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
import { CALL_STATUS_LABEL, formatCallDuration, isVoicemail } from "@/lib/calls";
import { cn, formatRelativeTime } from "@/lib/utils";

interface ThreadContact {
  id: string;
  name: string;
  email: string;
  hasUnread: boolean;
  /** Epoch ms of that contact's most recent message across every thread seen -- the actual sort key, not just whatever order the source queries happened to return. */
  lastMessageAt: number;
}

/** Merges thread lists from one or more /api/gmail/threads responses into one contact per row, keeping the latest message time and unread flag across every thread seen for that contact. */
function mergeThreadsByContact(threadLists: any[][]): ThreadContact[] {
  const byContactId = new Map<string, ThreadContact>();
  for (const threads of threadLists) {
    for (const t of threads) {
      if (!t.contactId) continue;
      const lastMessageAt = t.date ? new Date(t.date).getTime() : 0;
      const existing = byContactId.get(t.contactId);
      if (!existing) {
        byContactId.set(t.contactId, {
          id: t.contactId,
          name: t.contactName,
          email: t.contactEmail,
          hasUnread: !!t.isUnread,
          lastMessageAt,
        });
      } else {
        if (t.isUnread) existing.hasUnread = true;
        if (lastMessageAt > existing.lastMessageAt) existing.lastMessageAt = lastMessageAt;
      }
    }
  }
  return Array.from(byContactId.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
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
  const [searchResults, setSearchResults] = useState<ThreadContact[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(urlContactId);
  const [replyTarget, setReplyTarget] = useState<Extract<TimelineItem, { type: "email" }> | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  // Column 1: distinct contacts ordered by their actual most recent message
  // time (mergeThreadsByContact sorts on that directly, not on whatever
  // order the source queries happened to return them in), with any
  // genuinely unread contact pinned to the top of that ordering regardless
  // of recency. A brand-new contact with no messages yet still opens fine
  // via the URL -- it just won't be in this list until a conversation
  // actually starts.
  //
  // The "recent" query uses `q` (not `label: "INBOX"`) specifically so
  // outbound-only threads show up too -- a thread only carries the INBOX
  // label once something has landed there, so a contact we've emailed but
  // who hasn't replied yet lives entirely under SENT and was invisible here
  // before. That query is capped at the 30 most-recent threads by *any*
  // activity though, and this account sends a lot of daily outreach --
  // enough outbound volume can push an actual unread reply clean off that
  // list. A dedicated `is:unread` query is fetched alongside it specifically
  // so an unread contact always shows up here even if it's not otherwise
  // among the 30 most recent.
  useEffect(() => {
    let cancelled = false;

    function loadContacts(showLoading: boolean) {
      if (showLoading) setLoadingContacts(true);
      Promise.all([
        fetch(`/api/gmail/threads?${new URLSearchParams({ scope: "agency", q: "in:inbox OR in:sent" })}`).then((r) => r.json()),
        fetch(`/api/gmail/threads?${new URLSearchParams({ scope: "agency", q: "is:unread" })}`).then((r) => r.json()),
      ])
        .then(([recentData, unreadData]) => {
          if (cancelled) return;
          const recentThreads = Array.isArray(recentData.threads) ? recentData.threads : [];
          const unreadThreads = Array.isArray(unreadData.threads) ? unreadData.threads : [];

          const merged = mergeThreadsByContact([recentThreads, unreadThreads]);
          const unread = merged.filter((c) => c.hasUnread);
          const rest = merged.filter((c) => !c.hasUnread);
          setContacts([...unread, ...rest]);
        })
        .catch(() => {
          if (!cancelled) toast.error("Couldn't load conversations.");
        })
        .finally(() => {
          if (!cancelled) setLoadingContacts(false);
        });
    }

    loadContacts(true);
    // A new reply (or its read/unread state changing elsewhere, e.g. the
    // main Inbox) wouldn't otherwise show up in this list without a reload.
    const interval = setInterval(() => loadContacts(false), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (urlContactId) setSelectedId(urlContactId);
  }, [urlContactId]);

  // The list above only ever holds ~30 recent threads plus whatever's
  // currently unread -- searching it client-side meant an older, already-read
  // conversation (like one from weeks ago) could exist and still be openable
  // by direct link, yet be unfindable by typing its name, because it was
  // never in that small preloaded set to begin with. Typing a search now
  // queries Gmail directly (debounced) instead of filtering that snapshot,
  // so it actually finds anything, not just what happened to already be loaded.
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/gmail/threads?${new URLSearchParams({ scope: "agency", q: `${term} (in:inbox OR in:sent)` })}`)
        .then((res) => res.json())
        .then((data) => {
          const threads = Array.isArray(data.threads) ? data.threads : [];
          setSearchResults(mergeThreadsByContact([threads]));
        })
        .catch(() => toast.error("Search failed."))
        .finally(() => setSearching(false));
    }, 400);

    return () => clearTimeout(handle);
  }, [search]);

  function selectContact(id: string) {
    setSelectedId(id);
    router.replace(`/conversations?contactId=${id}`, { scroll: false });
  }

  const displayedContacts = search.trim() ? (searchResults ?? []) : contacts;

  const { contact, isLoading: contactLoading } = useContact(selectedId);
  const { items, isLoading: timelineLoading, refetch: refetchTimeline } = useContactTimeline(selectedId);
  const { runs } = useContactAutomationRuns(selectedId);
  const { updateContact } = useContacts();
  const { tags: tagSuggestions } = useContactTags();

  const lastEmail = [...items].reverse().find((i): i is Extract<TimelineItem, { type: "email" }> => i.type === "email");

  // Messages render oldest-first (a normal email/chat reading order), but
  // nothing was ever scrolling the pane down -- opening a conversation, or
  // this same one picking up a fresh reply via its 30s poll, just left the
  // scroll position wherever it already was (the very top, for a first
  // open), so the newest message was invisible below the fold instead of
  // "not there." Jumps to the latest whenever the messages for the open
  // conversation change, or when switching to a different conversation.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [items, selectedId]);

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
          {(search.trim() ? searching : loadingContacts) ? (
            <p className="text-text-muted p-4 text-center text-sm">{search.trim() ? "Searching..." : "Loading..."}</p>
          ) : displayedContacts.length === 0 ? (
            <p className="text-text-muted p-4 text-center text-sm">
              {search.trim() ? `No conversations match "${search.trim()}".` : "No conversations yet."}
            </p>
          ) : (
            displayedContacts.map((c) => (
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
                  <p className={cn("truncate text-sm", c.hasUnread ? "text-text-primary font-semibold" : "text-text-primary font-medium")}>
                    {c.name}
                  </p>
                  <p className="text-text-muted truncate text-xs">{c.email}</p>
                </div>
                {c.hasUnread && <span className="bg-brand-primary size-2 shrink-0 rounded-full" title="Unread messages" />}
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
                          "max-w-[85%] min-w-[280px] overflow-hidden rounded-card border shadow-sm",
                          item.isOutgoing ? "border-brand-primary/30" : "border-border",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-between gap-3 border-b px-3.5 py-2",
                            item.isOutgoing ? "border-brand-primary/20 bg-brand-primary/5" : "border-border bg-surface-secondary",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            {item.isUnread && <span className="bg-brand-primary size-1.5 shrink-0 rounded-full" title="Unread" />}
                            <p className="text-text-primary truncate text-xs font-semibold">{item.subject || "(no subject)"}</p>
                          </div>
                          <span className="text-text-muted shrink-0 text-[11px]">{formatRelativeTime(item.date)}</span>
                        </div>
                        {/* Automated/manual emails are HTML-designed templates -- rendered as-is
                            in a sandboxed, auto-sized iframe (same technique as the old
                            conversation modal) instead of stripped to plain text, which would
                            have thrown away the actual design. */}
                        {item.html ? (
                          <iframe
                            srcDoc={item.html}
                            className="w-full border-none bg-white"
                            style={{ minHeight: "60px" }}
                            sandbox="allow-same-origin"
                            title={item.subject || "Email content"}
                            onLoad={(e) => {
                              const iframe = e.currentTarget;
                              iframe.style.height = (iframe.contentDocument?.body?.scrollHeight ?? 60) + "px";
                            }}
                          />
                        ) : (
                          <p className="text-text-primary whitespace-pre-wrap bg-white p-3.5 text-sm">{item.text}</p>
                        )}
                        <div className="border-border flex justify-end border-t px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => setReplyTarget(item)}
                            className="text-text-secondary hover:text-brand-primary inline-flex items-center gap-1 text-xs font-medium"
                          >
                            <Reply className="size-3" />
                            Reply
                          </button>
                        </div>
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
                        {isVoicemail(item.answeredBy) && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Voicemail
                          </span>
                        )}
                        {item.recordingSid && (
                          <audio controls preload="none" className="h-6 w-40" src={`/api/calls/${item.id}/recording`} />
                        )}
                        <span className="text-text-muted">{formatRelativeTime(item.date)}</span>
                      </div>
                    </div>
                  ),
                )
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              <button
                onClick={() => (lastEmail ? setReplyTarget(lastEmail) : setComposeOpen(true))}
                className="border-border text-text-muted hover:border-brand-primary hover:text-text-primary bg-white flex-1 rounded-full border px-4 py-2.5 text-left text-sm transition-colors"
              >
                {lastEmail ? `Reply to ${contact?.name ?? "contact"}…` : `Email ${contact?.name ?? "contact"}…`}
              </button>
              {lastEmail && (
                <Button size="sm" variant="secondary" onClick={() => setComposeOpen(true)}>
                  <Mail className="size-3.5" />
                  New Email
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
      {contact && replyTarget && (
        <ComposeModal
          open={!!replyTarget}
          onClose={() => {
            setReplyTarget(null);
            refetchTimeline();
          }}
          mode="reply"
          scope="agency"
          defaultTo={replyTarget.isOutgoing ? replyTarget.to : replyTarget.from}
          defaultSubject={replyTarget.subject.startsWith("Re:") ? replyTarget.subject : `Re: ${replyTarget.subject}`}
          threadId={replyTarget.threadId}
          inReplyTo={replyTarget.id}
          references={replyTarget.id}
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
