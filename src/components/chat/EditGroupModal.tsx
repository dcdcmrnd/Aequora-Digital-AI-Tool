"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatRoom } from "./ChatPageClient";

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Props {
  room: ChatRoom;
  teamMembers: TeamMember[];
  currentUserId: string;
  isAdmin: boolean;
  onUpdated: (room: ChatRoom) => void;
  onDeleted: (roomId: string) => void;
  onClose: () => void;
}

export function EditGroupModal({ room, teamMembers, currentUserId, isAdmin, onUpdated, onDeleted, onClose }: Props) {
  const [name, setName] = useState(room.name ?? "");
  const [members, setMembers] = useState<TeamMember[]>(room.members);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const memberIds = new Set(members.map((m) => m.id));
  const nonMembers = teamMembers.filter((t) => !memberIds.has(t.id));

  const addMember = (m: TeamMember) => setMembers((prev) => [...prev, m]);
  const removeMember = (id: string) => {
    if (id === room.createdById) return; // can't remove creator
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const save = async () => {
    setSaving(true);
    setError("");

    const originalIds = new Set(room.members.map((m) => m.id));
    const currentIds = new Set(members.map((m) => m.id));
    const addMemberIds = members.filter((m) => !originalIds.has(m.id)).map((m) => m.id);
    const removeMemberIds = room.members.filter((m) => !currentIds.has(m.id)).map((m) => m.id);

    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, addMemberIds, removeMemberIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }
      const data = await res.json();
      onUpdated({ ...room, name: data.room.name, members: data.room.members });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete");
        return;
      }
      onDeleted(room.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-card shadow-modal w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text-primary">Edit Group</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Group name */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              className="w-full px-3 py-2 text-sm border border-border rounded-btn focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          {/* Current members */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Members ({members.length})
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {members.map((m) => {
                const isCreator = m.id === room.createdById;
                const isSelf = m.id === currentUserId;
                return (
                  <div key={m.id} className="flex items-center gap-3 py-1.5">
                    <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{m.name}</p>
                      {isCreator && (
                        <p className="text-[10px] text-brand-primary font-medium">Creator</p>
                      )}
                    </div>
                    {!isCreator && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-xs text-red-500 hover:text-red-600 px-2 py-0.5 border border-red-200 rounded transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    {isCreator && isSelf && (
                      <span className="text-[10px] text-text-muted">You</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add members */}
          {nonMembers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Add Members</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {nonMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-1.5">
                    <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                    <span className="flex-1 text-sm text-text-primary truncate">{m.name}</span>
                    <button
                      onClick={() => addMember(m)}
                      className="text-xs text-brand-primary hover:text-brand-primary/80 px-2 py-0.5 border border-brand-primary/30 rounded transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Delete zone */}
          {(isAdmin || currentUserId === room.createdById) && (
            <div className="pt-2 border-t border-border">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 text-sm text-red-500 border border-red-200 rounded-btn hover:bg-red-50 transition-colors"
                >
                  Delete Group Chat
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary text-center">
                    Delete <strong>{name || "this group"}</strong>? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 text-sm border border-border rounded-btn hover:bg-surface-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteGroup}
                      disabled={deleting}
                      className="flex-1 py-2 text-sm bg-red-500 text-white rounded-btn hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-btn hover:bg-surface-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-brand-primary text-white rounded-btn hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
