"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InviteUserModal } from "./InviteUserModal";
import { PendingInvitesList } from "./PendingInvitesList";
import { EditUserModal } from "./EditUserModal";
import type { UserProfile } from "@/types";

interface Props {
  users: UserProfile[];
  isAdmin: boolean;
  currentUserId: string;
}

export function TeamView({ users: initialUsers, isAdmin, currentUserId }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [tab, setTab] = useState<"members" | "pending">("members");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [inviteRefresh, setInviteRefresh] = useState(0);

  const refreshUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.users) setUsers(data.users);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Team</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {users.length} {users.length === 1 ? "member" : "members"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <PlusIcon />
            Invite Member
          </Button>
        )}
      </div>

      {/* Tabs (admin only) */}
      {isAdmin && (
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setTab("members")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "members"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "pending"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Pending Invites
          </button>
        </div>
      )}

      {/* Members grid */}
      {tab === "members" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div
              key={user.id}
              className={`bg-white border border-border rounded-card p-4 ${
                isAdmin ? "cursor-pointer hover:border-brand-primary/30 hover:shadow-sm transition-all" : ""
              }`}
              onClick={() => isAdmin && setEditUser(user)}
            >
              <div className="flex items-start gap-3">
                <Avatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="text-text-muted font-normal"> (you)</span>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant={user.role === "admin" ? "default" : "muted"} className="capitalize">
                      {user.role}
                    </Badge>
                    <StatusBadge status={user.status} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {tab === "pending" && isAdmin && (
        <PendingInvitesList
          refresh={inviteRefresh}
          onRefresh={() => setInviteRefresh((n) => n + 1)}
        />
      )}

      {/* Modals */}
      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => {
          refreshUsers();
          setInviteRefresh((n) => n + 1);
        }}
      />

      {editUser && (
        <EditUserModal
          user={editUser}
          open={!!editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => {
            refreshUsers();
            setEditUser(null);
          }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
