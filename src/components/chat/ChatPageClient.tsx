"use client";

import { useState, useEffect } from "react";
import { RoomList } from "./RoomList";
import { MessageThread } from "./MessageThread";
import { NewChatModal } from "./NewChatModal";

export interface ChatRoom {
  id: string;
  name: string | null;
  isGroup: boolean;
  members: { id: string; name: string; avatarUrl: string | null }[];
  lastMessage: { content: string; senderName: string; createdAt: string } | null;
  unreadCount: number;
}

interface Props {
  initialRooms: ChatRoom[];
  teamMembers: { id: string; name: string; avatarUrl: string | null }[];
  currentUserId: string;
  currentUserName: string;
}

export function ChatPageClient({ initialRooms, teamMembers, currentUserId, currentUserName }: Props) {
  const [rooms, setRooms] = useState<ChatRoom[]>(initialRooms);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    initialRooms[0]?.id ?? null
  );
  const [showNewChat, setShowNewChat] = useState(false);

  // Poll rooms list every 5 s to refresh unread counts + new rooms
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch("/api/chat/rooms");
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  const handleRoomCreated = (room: ChatRoom) => {
    setRooms((prev) => {
      const exists = prev.find((r) => r.id === room.id);
      return exists ? prev : [room, ...prev];
    });
    setActiveRoomId(room.id);
    setShowNewChat(false);
  };

  const markRoomRead = (roomId: string) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white border border-border rounded-card overflow-hidden">
      {/* Left panel — room list */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Messages</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-primary border border-brand-primary/30 rounded-btn hover:bg-brand-primary/5 transition-colors"
          >
            <span className="text-base leading-none">+</span> New
          </button>
        </div>

        <RoomList
          rooms={rooms}
          activeRoomId={activeRoomId}
          currentUserId={currentUserId}
          onSelect={(id) => {
            setActiveRoomId(id);
            markRoomRead(id);
          }}
        />
      </div>

      {/* Right panel — thread */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeRoom ? (
          <MessageThread
            room={activeRoom}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onMessagesRead={() => markRoomRead(activeRoom.id)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3">
            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" />
            </svg>
            <p className="text-sm">Select a conversation or start a new one</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-brand-primary/90 transition-colors"
            >
              Start a chat
            </button>
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          onCreated={handleRoomCreated}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  );
}
