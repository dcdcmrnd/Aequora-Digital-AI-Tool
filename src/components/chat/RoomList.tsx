"use client";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatRoom } from "./ChatPageClient";

interface Props {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  currentUserId: string;
  onSelect: (id: string) => void;
}

function getRoomName(room: ChatRoom, currentUserId: string) {
  if (room.name) return room.name;
  const other = room.members.find((m) => m.id !== currentUserId);
  return other?.name ?? "Unknown";
}

function getRoomAvatar(room: ChatRoom, currentUserId: string) {
  if (room.isGroup) return null;
  return room.members.find((m) => m.id !== currentUserId) ?? null;
}

export function RoomList({ rooms, activeRoomId, currentUserId, onSelect }: Props) {
  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <p className="text-xs text-text-muted">No conversations yet.<br />Start one with the + button.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {rooms.map((room) => {
        const name = getRoomName(room, currentUserId);
        const avatarUser = getRoomAvatar(room, currentUserId);
        const isActive = room.id === activeRoomId;

        return (
          <button
            key={room.id}
            onClick={() => onSelect(room.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50",
              isActive ? "bg-brand-primary/8" : "hover:bg-surface-secondary"
            )}
          >
            {/* Avatar */}
            {room.isGroup ? (
              <div className="w-9 h-9 flex-shrink-0 rounded-full bg-brand-primary/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            ) : (
              <Avatar name={name} avatarUrl={avatarUser?.avatarUrl ?? null} size="sm" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={cn("text-sm truncate", room.unreadCount > 0 ? "font-semibold text-text-primary" : "font-medium text-text-primary")}>
                  {name}
                </span>
                {room.lastMessage && (
                  <span className="text-[10px] text-text-muted ml-1 flex-shrink-0">
                    {formatTime(room.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {room.lastMessage && (
                <p className="text-xs text-text-secondary truncate mt-0.5">
                  {room.lastMessage.content}
                </p>
              )}
            </div>

            {/* Unread badge */}
            {room.unreadCount > 0 && (
              <span className="w-5 h-5 flex-shrink-0 bg-brand-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {room.unreadCount > 9 ? "9+" : room.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
