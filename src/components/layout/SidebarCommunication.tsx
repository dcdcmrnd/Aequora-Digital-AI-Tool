"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import { useChatHeads } from "@/lib/chatHeadsStore";
import { cn } from "@/lib/utils";

interface RoomSummary {
  id: string;
  name: string | null;
  isGroup: boolean;
  members: { id: string; name: string; avatarUrl: string | null }[];
  unreadCount: number;
}

const MAX_ROOMS = 6;

function roomLabel(room: RoomSummary, currentUserId: string): string {
  if (room.name) return room.name;
  const other = room.members.find((m) => m.id !== currentUserId);
  return other?.name ?? "Chat";
}

interface SidebarCommunicationProps {
  currentUserId: string;
}

export function SidebarCommunication({ currentUserId }: SidebarCommunicationProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const { openHead, activeHeadId } = useChatHeads();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/rooms");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setRooms(data.rooms ?? []);
      } catch {
        // Sidebar widget — fail silently, the full Chat page still works.
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // A 1-on-1 room with no other member (e.g. leftover test data, or the
  // other person's account was removed) has nothing to show — hide it
  // rather than display a blank "Chat" entry.
  const visibleRooms = rooms.filter((room) => room.isGroup || room.members.some((m) => m.id !== currentUserId));

  if (visibleRooms.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {visibleRooms.slice(0, MAX_ROOMS).map((room) => {
        const isActive = activeHeadId === room.id;
        return (
          <button
            key={room.id}
            type="button"
            onClick={() => openHead(room)}
            className={cn(
              "flex w-full items-center gap-3 rounded-btn px-3 py-1.5 text-sm transition-colors",
              isActive ? "text-white" : "text-[#94A3B8] hover:bg-white/5 hover:text-white",
            )}
          >
            {room.isGroup ? (
              <Users className="size-3.5 shrink-0" />
            ) : (
              <span className="size-1.5 shrink-0 rounded-full bg-[#475569]" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">{roomLabel(room, currentUserId)}</span>
            {room.unreadCount > 0 && (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                {room.unreadCount > 9 ? "9+" : room.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
