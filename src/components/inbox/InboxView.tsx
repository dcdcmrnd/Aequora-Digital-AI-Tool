"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { ComposeModal } from "./ComposeModal";
import { SignatureManager } from "./SignatureManager";
import { cn } from "@/lib/utils";

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messageCount: number;
  contactName: string;
  contactEmail: string;
}

interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  isOutgoing: boolean;
  html: string;
  text: string;
}

interface ThreadDetail {
  id: string;
  subject: string;
  messages: ThreadMessage[];
}

type Label = "INBOX" | "SENT" | "SPAM";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  isConnected: boolean;
  isAdmin: boolean;
  currentUserId: string;
}

export function InboxView({ isConnected, isAdmin, currentUserId }: Props) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<Label>("INBOX");
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [signaturesOpen, setSignaturesOpen] = useState(false);
  // Mobile: show thread list (false) or email detail (true)
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchThreads = useCallback(async (label: Label, pageToken?: string) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ label });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      if (data.error === "not_connected") return;
      setThreads((prev) => pageToken ? [...prev, ...data.threads] : data.threads);
      setNextPageToken(data.nextPageToken);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    setThreads([]);
    setSelected(null);
    setMobileShowDetail(false);
    fetchThreads(activeLabel);
  }, [isConnected, activeLabel, fetchThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected]);

  const openThread = async (thread: ThreadSummary) => {
    setSelected(null);
    setLoadingThread(true);
    setMobileShowDetail(true);
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, isUnread: false } : t))
    );
    try {
      const res = await fetch(`/api/gmail/threads/${thread.id}`);
      const data = await res.json();
      setSelected(data);
    } finally {
      setLoadingThread(false);
    }
  };

  const goBackToList = () => {
    setMobileShowDetail(false);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-4">
          <MailIcon className="w-8 h-8 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Inbox not connected</h2>
        <p className="text-sm text-text-secondary mb-6 max-w-sm">
          Connect your <strong>info@aequoradigital.com</strong> Google account to view and send emails from the workspace.
        </p>
        {isAdmin ? (
          <Button onClick={() => (window.location.href = "/api/gmail/auth")}>
            <LinkIcon />
            Connect Gmail
          </Button>
        ) : (
          <p className="text-sm text-text-muted">Ask your admin to connect the inbox.</p>
        )}
      </div>
    );
  }

  const tabs: { label: Label; display: string }[] = [
    { label: "INBOX", display: "Inbox" },
    { label: "SENT", display: "Sent" },
    { label: "SPAM", display: "Spam" },
  ];

  const lastMessage = selected?.messages[selected.messages.length - 1];

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] bg-white border border-border rounded-card overflow-hidden">

      {/* ── Top header (always visible) ── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border flex-shrink-0 bg-white gap-3">
        {/* Mobile: show back arrow when in detail view */}
        {mobileShowDetail ? (
          <button
            onClick={goBackToList}
            className="md:hidden flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
        ) : (
          <div>
            <h1 className="text-base md:text-lg font-semibold text-text-primary leading-tight">Inbox</h1>
            <p className="text-[11px] text-text-muted hidden md:block">info@aequoradigital.com</p>
          </div>
        )}

        {/* Subject on mobile detail view */}
        {mobileShowDetail && selected && (
          <p className="md:hidden flex-1 text-sm font-medium text-text-primary truncate">{selected.subject || "(no subject)"}</p>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Signatures — icon only on mobile */}
          <button
            onClick={() => setSignaturesOpen(true)}
            className="text-xs text-text-secondary hover:text-brand-primary border border-border rounded-btn px-2 md:px-3 py-1.5 transition-colors hover:border-brand-primary"
            title="Manage Signatures"
          >
            <span className="hidden md:inline">Signatures</span>
            <SignatureIcon className="w-4 h-4 md:hidden" />
          </button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <PenIcon />
            <span className="hidden md:inline">Compose</span>
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — thread list */}
        {/* On mobile: visible only when NOT in detail view */}
        <div className={cn(
          "flex-col bg-surface-secondary/30",
          "w-full md:w-72 md:flex-shrink-0 md:border-r md:border-border",
          mobileShowDetail ? "hidden md:flex" : "flex"
        )}>
          {/* Tabs */}
          <div className="flex border-b border-border bg-white flex-shrink-0">
            {tabs.map((t) => (
              <button
                key={t.label}
                onClick={() => setActiveLabel(t.label)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-medium transition-colors",
                  activeLabel === t.label
                    ? "text-brand-primary border-b-2 border-brand-primary"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {t.display}
              </button>
            ))}
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loadingList && threads.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-muted">No conversations</div>
            ) : (
              <>
                {threads.map((thread) => {
                  const isSelected = selected?.id === thread.id;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => openThread(thread)}
                      className={cn(
                        "w-full text-left px-4 py-3.5 border-b border-border/50 transition-colors",
                        isSelected ? "bg-brand-primary/8 border-l-2 border-l-brand-primary" : "hover:bg-white",
                        thread.isUnread && !isSelected && "bg-blue-50/40"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-brand-primary">
                            {getInitials(thread.contactName)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={cn(
                              "text-sm truncate",
                              thread.isUnread ? "font-semibold text-text-primary" : "font-medium text-text-primary"
                            )}>
                              {thread.contactName}
                            </span>
                            <span className="text-[10px] text-text-muted flex-shrink-0">
                              {formatDate(thread.date)}
                            </span>
                          </div>
                          <p className={cn(
                            "text-xs truncate mb-0.5",
                            thread.isUnread ? "font-medium text-text-primary" : "text-text-secondary"
                          )}>
                            {thread.subject || "(no subject)"}
                          </p>
                          <p className="text-xs text-text-muted truncate">{thread.snippet}</p>
                        </div>
                        {thread.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </button>
                  );
                })}
                {nextPageToken && (
                  <button
                    onClick={() => fetchThreads(activeLabel, nextPageToken)}
                    className="w-full py-3 text-xs text-brand-primary hover:underline"
                    disabled={loadingList}
                  >
                    {loadingList ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel — email detail */}
        {/* On mobile: visible only when in detail view */}
        <div className={cn(
          "flex-1 flex-col overflow-hidden",
          mobileShowDetail ? "flex" : "hidden md:flex"
        )}>
          {loadingThread ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : !selected ? (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center px-8">
              <MailIcon className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Select a conversation to read it</p>
            </div>
          ) : (
            <>
              {/* Thread subject header — desktop only (mobile shows in top bar) */}
              <div className="hidden md:flex px-5 py-3 border-b border-border flex-shrink-0 items-center justify-between bg-white">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">{selected.subject || "(no subject)"}</h2>
                  <p className="text-xs text-text-muted mt-0.5">{selected.messages.length} message{selected.messages.length !== 1 ? "s" : ""}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setReplyOpen(true)}>
                  <ReplyIcon />
                  Reply
                </Button>
              </div>

              {/* Message bubbles */}
              <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-4 bg-surface-secondary/20">
                {selected.messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-2 md:gap-3", msg.isOutgoing ? "flex-row-reverse" : "flex-row")}>
                    {/* Avatar */}
                    {!msg.isOutgoing && (
                      <div className="w-8 h-8 rounded-full bg-brand-primary/15 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-xs font-semibold text-brand-primary">
                          {getInitials(msg.from.replace(/<.*>/, "").trim() || "?")}
                        </span>
                      </div>
                    )}
                    {msg.isOutgoing && (
                      <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-[10px] font-semibold text-white">Ae</span>
                      </div>
                    )}

                    <div
                      className={cn("flex flex-col", msg.isOutgoing ? "items-end" : "items-start")}
                      style={{ maxWidth: "min(75%, 520px)" }}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs font-medium text-text-secondary">
                          {msg.isOutgoing ? "Aequora Digital" : msg.from.replace(/<.*>/, "").trim()}
                        </span>
                        <span className="text-[10px] text-text-muted">{formatDate(msg.date)}</span>
                      </div>
                      <div className={cn(
                        "rounded-2xl overflow-hidden text-sm w-full",
                        msg.isOutgoing
                          ? "bg-brand-primary text-white rounded-tr-sm"
                          : "bg-white border border-border rounded-tl-sm shadow-sm"
                      )}>
                        {msg.html ? (
                          <div className="p-3">
                            <iframe
                              srcDoc={msg.html}
                              className="w-full border-none"
                              style={{ minHeight: "60px", height: "auto" }}
                              sandbox="allow-same-origin"
                              title="Email content"
                              onLoad={(e) => {
                                const iframe = e.currentTarget;
                                iframe.style.height = (iframe.contentDocument?.body?.scrollHeight ?? 60) + "px";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="px-4 py-3 whitespace-pre-wrap font-sans text-sm">
                            {msg.text}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Quick reply bar */}
              <div className="px-4 md:px-5 py-3 border-t border-border bg-white flex-shrink-0 flex items-center gap-2">
                <button
                  onClick={() => setReplyOpen(true)}
                  className="flex-1 text-left px-4 py-2.5 rounded-full border border-border text-sm text-text-muted hover:border-brand-primary hover:text-text-primary transition-colors bg-surface-secondary/40"
                >
                  Reply to {lastMessage?.isOutgoing ? "this thread" : (lastMessage?.from.replace(/<.*>/, "").trim() || "sender")}…
                </button>
                {/* Mobile reply button */}
                <button
                  onClick={() => setReplyOpen(true)}
                  className="md:hidden flex-shrink-0 w-10 h-10 bg-brand-primary text-white rounded-full flex items-center justify-center"
                >
                  <ReplyIcon />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Signature manager */}
      <SignatureManager
        open={signaturesOpen}
        onClose={() => setSignaturesOpen(false)}
        currentUserId={currentUserId}
      />

      {/* Compose modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        mode="compose"
      />

      {/* Reply modal */}
      {selected && lastMessage && (
        <ComposeModal
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          mode="reply"
          defaultTo={lastMessage.isOutgoing ? lastMessage.to : lastMessage.from}
          defaultSubject={selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`}
          threadId={selected.id}
          inReplyTo={lastMessage.id}
          references={lastMessage.id}
        />
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function SignatureIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
