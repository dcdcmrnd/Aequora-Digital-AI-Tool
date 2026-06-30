"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ComposeModal } from "./ComposeModal";
import { cn } from "@/lib/utils";

interface EmailSummary {
  id: string;
  threadId: string;
  snippet: string;
  isUnread: boolean;
  from: string;
  to: string;
  subject: string;
  date: string;
}

interface EmailDetail extends EmailSummary {
  html: string;
  text: string;
  replyTo: string;
  labelIds: string[];
}

type Label = "INBOX" | "SENT" | "SPAM";

function parseSender(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return {
    name: match?.[1]?.trim() || from,
    email: match?.[2]?.trim() || from,
  };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface Props {
  isConnected: boolean;
  isAdmin: boolean;
}

export function InboxView({ isConnected, isAdmin }: Props) {
  const [messages, setMessages] = useState<EmailSummary[]>([]);
  const [selected, setSelected] = useState<EmailDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<Label>("INBOX");
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const fetchMessages = useCallback(async (label: Label, pageToken?: string) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ label });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`/api/gmail/messages?${params}`);
      const data = await res.json();
      if (data.error === "not_connected") return;
      setMessages((prev) => pageToken ? [...prev, ...data.messages] : data.messages);
      setNextPageToken(data.nextPageToken);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    setMessages([]);
    setSelected(null);
    fetchMessages(activeLabel);
  }, [isConnected, activeLabel, fetchMessages]);

  const openMessage = async (msg: EmailSummary) => {
    setSelected(null);
    setLoadingDetail(true);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m))
    );
    try {
      const res = await fetch(`/api/gmail/messages/${msg.id}`);
      const data = await res.json();
      setSelected(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Not connected state
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

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] bg-white border border-border rounded-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Inbox</h1>
          <p className="text-xs text-text-muted mt-0.5">info@aequoradigital.com</p>
        </div>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <PenIcon />
          Compose
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — email list */}
        <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border">
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

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {loadingList && messages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-muted">No messages</div>
            ) : (
              <>
                {messages.map((msg) => {
                  const { name } = parseSender(msg.from);
                  const isSelected = selected?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      onClick={() => openMessage(msg)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border transition-colors",
                        isSelected ? "bg-brand-primary/5" : "hover:bg-surface-hover",
                        msg.isUnread && "bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {msg.isUnread && (
                            <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
                          )}
                          <span className={cn("text-sm truncate", msg.isUnread ? "font-semibold text-text-primary" : "font-medium text-text-primary")}>
                            {name}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted flex-shrink-0 ml-2">
                          {formatDate(msg.date)}
                        </span>
                      </div>
                      <p className={cn("text-xs truncate mb-0.5", msg.isUnread ? "text-text-primary font-medium" : "text-text-secondary")}>
                        {msg.subject || "(no subject)"}
                      </p>
                      <p className="text-xs text-text-muted truncate">{msg.snippet}</p>
                    </button>
                  );
                })}
                {nextPageToken && (
                  <button
                    onClick={() => fetchMessages(activeLabel, nextPageToken)}
                    className="w-full py-3 text-xs text-brand-primary hover:underline"
                    disabled={loadingList}
                  >
                    {loadingList ? "Loading..." : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel — email detail */}
        <div className="flex-1 overflow-y-auto">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <MailIcon className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Select an email to read it</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Email header */}
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-lg font-semibold text-text-primary mb-4">
                  {selected.subject || "(no subject)"}
                </h2>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-text-muted w-8">From</span>
                      <span className="text-text-primary">{selected.from}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-text-muted w-8">To</span>
                      <span className="text-text-secondary">{selected.to}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-text-muted w-8">Date</span>
                      <span className="text-text-secondary">
                        {new Date(selected.date).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setReplyOpen(true)}
                  >
                    <ReplyIcon />
                    Reply
                  </Button>
                </div>
              </div>

              {/* Email body */}
              <div className="flex-1 overflow-auto">
                {selected.html ? (
                  <iframe
                    srcDoc={selected.html}
                    className="w-full h-full border-none"
                    sandbox="allow-same-origin"
                    title="Email content"
                  />
                ) : (
                  <div className="px-6 py-5 text-sm text-text-primary whitespace-pre-wrap font-mono">
                    {selected.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        mode="compose"
      />

      {/* Reply modal */}
      {selected && (
        <ComposeModal
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          mode="reply"
          defaultTo={selected.replyTo || selected.from}
          defaultSubject={selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`}
          threadId={selected.threadId}
          inReplyTo={selected.id}
          references={selected.id}
        />
      )}
    </div>
  );
}

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

function Spinner() {
  return (
    <svg className="animate-spin w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
