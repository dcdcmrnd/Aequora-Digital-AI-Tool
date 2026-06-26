"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatRoom } from "./ChatPageClient";

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  room: ChatRoom;
  currentUserId: string;
  currentUserName: string;
  onMessagesRead: () => void;
}

function getRoomTitle(room: ChatRoom, currentUserId: string) {
  if (room.name) return room.name;
  const other = room.members.find((m) => m.id !== currentUserId);
  return other?.name ?? "Chat";
}

export function MessageThread({ room, currentUserId, currentUserName, onMessagesRead }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Use a ref so onMessagesRead never triggers fetchMessages to recreate
  const onMessagesReadRef = useRef(onMessagesRead);
  useEffect(() => { onMessagesReadRef.current = onMessagesRead; });

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        onMessagesReadRef.current();
      }
    } catch {
      // network error — keep existing messages
    } finally {
      setLoading(false);
    }
  }, [room.id]); // onMessagesRead intentionally excluded via ref

  // Load messages when room changes
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages();
  }, [room.id, fetchMessages]);

  // Poll for new messages every 3 s
  useEffect(() => {
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      content: text,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      sender: { id: currentUserId, name: currentUserName, avatarUrl: null },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const title = getRoomTitle(room, currentUserId);
  const otherMembers = room.members.filter((m) => m.id !== currentUserId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {room.isGroup ? (
            <p className="text-xs text-text-muted">{room.members.length} members</p>
          ) : (
            <p className="text-xs text-text-muted">
              {otherMembers.map((m) => m.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isMine = msg.senderId === currentUserId;
              const prev = messages[i - 1];
              const showAvatar = !isMine && (!prev || prev.senderId !== msg.senderId);
              const showName = showAvatar;

              return (
                <div key={msg.id} className={cn("flex items-end gap-2", isMine && "flex-row-reverse")}>
                  {!isMine ? (
                    showAvatar ? (
                      <Avatar name={msg.sender.name} avatarUrl={msg.sender.avatarUrl} size="sm" />
                    ) : (
                      <div className="w-8 flex-shrink-0" />
                    )
                  ) : null}

                  <div className={cn("max-w-[70%] flex flex-col", isMine && "items-end")}>
                    {showName && (
                      <span className="text-[11px] text-text-muted mb-1 ml-1">{msg.sender.name}</span>
                    )}
                    <div
                      className={cn(
                        "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                        isMine
                          ? "bg-brand-primary text-white rounded-br-sm"
                          : "bg-surface-secondary text-text-primary rounded-bl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-text-muted mt-1 mx-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`Message ${title}…`}
            className="flex-1 resize-none px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:border-brand-primary transition-colors bg-surface-secondary placeholder:text-text-muted max-h-32"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
