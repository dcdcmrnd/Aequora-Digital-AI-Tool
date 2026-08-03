"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

import { ComposeModal } from "@/components/inbox/ComposeModal";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
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

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

interface ContactConversationModalProps {
  open: boolean;
  onClose: () => void;
  contactEmail: string;
  contactName: string;
}

export function ContactConversationModal({ open, onClose, contactEmail, contactName }: ContactConversationModalProps) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setThreads(null);
    setNotConnected(false);
    setLoadingList(true);

    const q = `from:${contactEmail} OR to:${contactEmail}`;
    fetch(`/api/gmail/threads?${new URLSearchParams({ q, scope: "agency" })}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok || !Array.isArray(data.threads)) {
          if (data.error === "not_connected") setNotConnected(true);
          else toast.error("Couldn't load this conversation.");
          return;
        }
        setThreads(data.threads);
      })
      .catch(() => toast.error("Couldn't load this conversation."))
      .finally(() => setLoadingList(false));
  }, [open, contactEmail]);

  async function openThread(thread: ThreadSummary) {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/gmail/threads/${thread.id}?${new URLSearchParams({ scope: "agency" })}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.messages)) {
        toast.error("Couldn't load this conversation.");
        return;
      }
      setSelected(data);
    } catch {
      toast.error("Couldn't load this conversation.");
    } finally {
      setLoadingThread(false);
    }
  }

  const lastMessage = selected?.messages[selected.messages.length - 1];

  return (
    <>
      <Modal
        open={open && !replyOpen}
        onClose={onClose}
        title={selected ? selected.subject || "(no subject)" : `Conversation with ${contactName}`}
        size="xl"
        className="max-w-6xl"
      >
        <div className="flex h-[70vh] flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to conversations
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {loadingThread ? (
                  <p className="text-text-muted text-sm">Loading...</p>
                ) : (
                  selected.messages.map((msg) => (
                    <div key={msg.id} className="rounded-card border border-border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-text-primary text-xs font-medium">
                          {msg.isOutgoing ? "Aequora Digital" : msg.from.replace(/<.*>/, "").trim()}
                        </span>
                        <span className="text-text-muted text-[11px]">{formatDate(msg.date)}</span>
                      </div>
                      {msg.html ? (
                        <iframe
                          srcDoc={msg.html}
                          className="w-full border-none"
                          style={{ minHeight: "60px" }}
                          sandbox="allow-same-origin"
                          title="Email content"
                          onLoad={(e) => {
                            const iframe = e.currentTarget;
                            iframe.style.height = (iframe.contentDocument?.body?.scrollHeight ?? 60) + "px";
                          }}
                        />
                      ) : (
                        <p className="text-text-primary whitespace-pre-wrap text-sm">{msg.text}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                <button
                  onClick={() => setReplyOpen(true)}
                  className="border-border text-text-muted hover:border-brand-primary hover:text-text-primary bg-surface-secondary/40 flex-1 rounded-full border px-4 py-2.5 text-left text-sm transition-colors"
                >
                  Reply to {contactName}…
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {notConnected ? (
                <p className="text-text-muted p-6 text-center text-sm">
                  Gmail isn't connected. Connect it in Settings → Agency Email to see conversations here.
                </p>
              ) : loadingList ? (
                <p className="text-text-muted p-6 text-center text-sm">Loading...</p>
              ) : !threads || threads.length === 0 ? (
                <p className="text-text-muted p-6 text-center text-sm">
                  No email conversation found with {contactEmail} yet.
                </p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => openThread(thread)}
                    className="hover:bg-surface-secondary/60 w-full border-b border-border px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm text-text-primary", thread.isUnread ? "font-semibold" : "font-medium")}>
                        {thread.subject || "(no subject)"}
                      </span>
                      <span className="text-text-muted shrink-0 text-[11px]">{formatDate(thread.date)}</span>
                    </div>
                    <p className="text-text-muted mt-0.5 truncate text-xs">{thread.snippet}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>

      {selected && lastMessage && (
        <ComposeModal
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          mode="reply"
          scope="agency"
          defaultTo={lastMessage.isOutgoing ? lastMessage.to : lastMessage.from}
          defaultSubject={selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`}
          threadId={selected.id}
          inReplyTo={lastMessage.id}
          references={lastMessage.id}
        />
      )}
    </>
  );
}
