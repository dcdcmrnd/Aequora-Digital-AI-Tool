"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatRoom } from "./ChatPageClient";
import toast from "react-hot-toast";

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Props {
  teamMembers: TeamMember[];
  currentUserId: string;
  onCreated: (room: ChatRoom) => void;
  onClose: () => void;
}

export function NewChatModal({ teamMembers, currentUserId, onCreated, onClose }: Props) {
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = teamMembers.filter(
    (m) =>
      m.id !== currentUserId &&
      m.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    if (mode === "dm") {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const canCreate =
    selectedIds.length > 0 && (mode === "dm" || groupName.trim().length > 0);

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedIds,
          name: mode === "group" ? groupName.trim() : undefined,
          isGroup: mode === "group",
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create chat"); return; }
      onCreated(data.room);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-card shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text-primary">New Conversation</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("dm"); setSelectedIds([]); }}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-btn transition-colors",
                mode === "dm"
                  ? "bg-brand-primary text-white"
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-hover"
              )}
            >
              Direct Message
            </button>
            <button
              onClick={() => { setMode("group"); setSelectedIds([]); }}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-btn transition-colors",
                mode === "group"
                  ? "bg-brand-primary text-white"
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-hover"
              )}
            >
              Group Chat
            </button>
          </div>

          {/* Group name */}
          {mode === "group" && (
            <input
              type="text"
              placeholder="Group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-input focus:outline-none focus:border-brand-primary"
            />
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search team members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-input focus:outline-none focus:border-brand-primary"
          />

          {/* Selected chips for group */}
          {mode === "group" && selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => {
                const m = teamMembers.find((x) => x.id === id);
                return m ? (
                  <span
                    key={id}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-brand-primary/10 text-brand-primary rounded-full"
                  >
                    {m.name}
                    <button onClick={() => toggle(id)} className="text-brand-primary/70 hover:text-brand-primary">×</button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Member list */}
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No members found</p>
            ) : (
              filtered.map((m) => {
                const isSelected = selectedIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-left transition-colors",
                      isSelected
                        ? "bg-brand-primary/10 text-brand-primary"
                        : "hover:bg-surface-secondary text-text-primary"
                    )}
                  >
                    <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                    <span className="flex-1 text-sm font-medium">{m.name}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary border border-border rounded-btn hover:bg-surface-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!canCreate || creating}
            className="px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-btn hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : mode === "dm" ? "Open Chat" : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
