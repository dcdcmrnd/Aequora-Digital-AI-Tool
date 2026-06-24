"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AccessLevel } from "@/types";
import toast from "react-hot-toast";

interface Member {
  userId: string;
  accessLevel: AccessLevel;
  grantedById: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
}

interface Props {
  projectId: string;
  members: Member[];
  currentUserId: string;
}

const ACCESS_COLORS: Record<AccessLevel, string> = {
  viewer: "bg-surface-secondary text-text-secondary",
  contributor: "bg-blue-100 text-blue-700",
  manager: "bg-teal-100 text-teal-700",
};

export function ProjectMembersTab({ projectId, members: initialMembers, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [saving, setSaving] = useState<string | null>(null);

  const updateAccessLevel = async (userId: string, accessLevel: AccessLevel) => {
    setSaving(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accessLevel }),
      });
      if (!res.ok) throw new Error();
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, accessLevel } : m))
      );
      toast.success("Access level updated.");
    } catch {
      toast.error("Failed to update access.");
    } finally {
      setSaving(null);
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;
    setSaving(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/access`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error();
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success(`${name} removed from project.`);
    } catch {
      toast.error("Failed to remove member.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Project Members</h2>
        <span className="text-xs text-text-muted">{members.length} member{members.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const isSelf = member.user.id === currentUserId;
          return (
            <div
              key={member.userId}
              className="flex items-center gap-3 p-3 bg-white border border-border rounded-card"
            >
              <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {member.user.name}
                    {isSelf && <span className="text-text-muted font-normal"> (you)</span>}
                  </p>
                  {member.user.role === "admin" && (
                    <Badge variant="muted">Admin</Badge>
                  )}
                </div>
                <p className="text-xs text-text-secondary truncate">{member.user.email}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={member.accessLevel}
                  onChange={(e) => updateAccessLevel(member.userId, e.target.value as AccessLevel)}
                  disabled={saving === member.userId || isSelf}
                  className={`text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary ${ACCESS_COLORS[member.accessLevel]}`}
                >
                  <option value="viewer">Viewer</option>
                  <option value="contributor">Contributor</option>
                  <option value="manager">Manager</option>
                </select>

                {!isSelf && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(member.userId, member.user.name)}
                    className="text-text-muted hover:text-danger px-2"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted mt-4">
        To add members, invite them via the Team page and grant project access during invite setup, or edit their permissions in the Team section.
      </p>
    </div>
  );
}
