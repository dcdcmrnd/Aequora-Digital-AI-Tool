"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface ChatHeadRoom {
  id: string;
  name: string | null;
  isGroup: boolean;
  members: { id: string; name: string; avatarUrl: string | null }[];
}

interface ChatHeadsContextValue {
  openHeads: ChatHeadRoom[];
  activeHeadId: string | null;
  openHead: (room: ChatHeadRoom) => void;
  closeHead: (roomId: string) => void;
  setActiveHead: (roomId: string | null) => void;
}

const ChatHeadsContext = createContext<ChatHeadsContextValue | null>(null);

const MAX_HEADS = 4;

export function ChatHeadsProvider({ children }: { children: React.ReactNode }) {
  const [openHeads, setOpenHeads] = useState<ChatHeadRoom[]>([]);
  const [activeHeadId, setActiveHeadId] = useState<string | null>(null);

  const openHead = useCallback((room: ChatHeadRoom) => {
    setOpenHeads((prev) => {
      if (prev.some((r) => r.id === room.id)) return prev;
      return [room, ...prev].slice(0, MAX_HEADS);
    });
    setActiveHeadId(room.id);
  }, []);

  const closeHead = useCallback((roomId: string) => {
    setOpenHeads((prev) => prev.filter((r) => r.id !== roomId));
    setActiveHeadId((prev) => (prev === roomId ? null : prev));
  }, []);

  return (
    <ChatHeadsContext.Provider value={{ openHeads, activeHeadId, openHead, closeHead, setActiveHead: setActiveHeadId }}>
      {children}
    </ChatHeadsContext.Provider>
  );
}

export function useChatHeads() {
  const ctx = useContext(ChatHeadsContext);
  if (!ctx) throw new Error("useChatHeads must be used within ChatHeadsProvider");
  return ctx;
}
