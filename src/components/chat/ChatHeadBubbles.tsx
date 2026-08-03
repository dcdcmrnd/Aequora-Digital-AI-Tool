"use client";

import { useSession } from "next-auth/react";
import { X } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { ChatHeadPanel, roomHeadLabel } from "@/components/chat/ChatHeadPanel";
import { useChatHeads } from "@/lib/chatHeadsStore";
import { cn } from "@/lib/utils";

export function ChatHeadBubbles() {
  const { data: session } = useSession();
  const { openHeads, activeHeadId, setActiveHead, closeHead } = useChatHeads();
  const currentUserId = session?.user?.id ?? "";

  if (openHeads.length === 0) return null;

  const activeRoom = openHeads.find((r) => r.id === activeHeadId) ?? null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {activeRoom && <ChatHeadPanel room={activeRoom} currentUserId={currentUserId} onClose={() => setActiveHead(null)} />}

      <div className="flex gap-2">
        {openHeads.map((room) => {
          const other = room.members.find((m) => m.id !== currentUserId);
          return (
            <div key={room.id} className="group relative">
              <button
                onClick={() => setActiveHead(activeHeadId === room.id ? null : room.id)}
                title={roomHeadLabel(room, currentUserId)}
                className={cn(
                  "rounded-full ring-2 ring-white shadow-lg transition-transform hover:-translate-y-0.5",
                  activeHeadId === room.id && "ring-brand-primary",
                )}
              >
                <Avatar name={roomHeadLabel(room, currentUserId)} avatarUrl={room.isGroup ? null : (other?.avatarUrl ?? null)} size="md" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeHead(room.id);
                }}
                className="bg-text-muted hover:bg-danger absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
