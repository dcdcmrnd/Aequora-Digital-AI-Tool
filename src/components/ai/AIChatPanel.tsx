"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "./ChatMessage";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  canUseTaskAssistant: boolean;
  canUseConsultant: boolean;
}

export function AIChatPanel({ canUseTaskAssistant, canUseConsultant }: Props) {
  const defaultMode = canUseTaskAssistant ? "task-assistant" : "consultant";
  const [mode, setMode] = useState<"task-assistant" | "consultant">(defaultMode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadHistory = async (m: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/ai/chat?mode=${m}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {}
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    loadHistory(mode);
  }, [mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI request failed.");
        setMessages((prev) => prev.slice(0, -1));
        setInput(text);
        return;
      }

      setMessages(data.history ?? []);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear this conversation?")) return;
    await fetch(`/api/ai/chat?mode=${mode}`, { method: "DELETE" });
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white border border-border rounded-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1 bg-surface-secondary rounded-btn p-1">
          {canUseTaskAssistant && (
            <button
              onClick={() => setMode("task-assistant")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === "task-assistant"
                  ? "bg-white shadow-sm text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Task Assistant
            </button>
          )}
          {canUseConsultant && (
            <button
              onClick={() => setMode("consultant")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === "consultant"
                  ? "bg-white shadow-sm text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Business Consultant
            </button>
          )}
        </div>

        <button
          onClick={handleClear}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
        {loadingHistory ? (
          <div className="text-sm text-text-muted text-center pt-8">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center pt-8">
            <p className="text-sm font-medium text-text-primary mb-1">
              {mode === "task-assistant" ? "Task Assistant" : "Business Consultant"}
            </p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {mode === "task-assistant"
                ? "Ask me what you should focus on today, what's due this week, or to help break down a complex task."
                : "Ask me about Aequora's services, pricing, sales strategy, client communication, or business growth."}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <SparklesIcon />
            </div>
            <div className="flex items-center gap-1 pt-2">
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "task-assistant"
                ? "What should I focus on today?"
                : "Ask about services, pricing, or strategy..."
            }
            rows={2}
            className="flex-1 px-3 py-2.5 border border-border rounded-input text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <Button
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim()}
            className="self-end"
          >
            Send
          </Button>
        </div>
        <p className="text-[10px] text-text-muted mt-1.5">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-brand-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
    </svg>
  );
}
