"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { ChatHeadRoom } from "@/lib/chatHeadsStore";

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null };
}

export function roomHeadLabel(room: ChatHeadRoom, currentUserId: string): string {
  if (room.name) return room.name;
  const other = room.members.find((m) => m.id !== currentUserId);
  return other?.name ?? "Chat";
}

function roomHeadAvatar(room: ChatHeadRoom, currentUserId: string) {
  if (room.isGroup) return null;
  return room.members.find((m) => m.id !== currentUserId)?.avatarUrl ?? null;
}

interface Props {
  room: ChatHeadRoom;
  currentUserId: string;
  onClose: () => void;
}

export function ChatHeadPanel({ room, currentUserId, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages`);
      if (res.ok && !cancelled) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInput("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[420px] w-80 flex-col overflow-hidden rounded-card border border-border bg-white shadow-2xl">
      <div className="bg-brand-dark flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={roomHeadLabel(room, currentUserId)} avatarUrl={roomHeadAvatar(room, currentUserId)} size="sm" />
          <span className="truncate text-sm font-medium text-white">{roomHeadLabel(room, currentUserId)}</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-text-muted text-center text-xs">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isOwn = m.senderId === currentUserId;
            return (
              <div key={m.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-1.5 text-sm",
                    isOwn ? "bg-brand-primary text-white" : "bg-surface-secondary text-text-primary",
                  )}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message..."
          className="border-border focus:ring-brand-primary flex-1 rounded-full border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-brand-primary flex size-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
