"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { UserPermissionsEditor } from "./UserPermissionsEditor";
import { ProjectAccessEditor } from "./ProjectAccessEditor";
import type { UserProfile, PermissionType } from "@/types";
import toast from "react-hot-toast";

interface Props {
  user: UserProfile;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}

interface ProjectAccessEntry {
  projectId: string;
  accessLevel: "viewer" | "contributor" | "manager";
}

export function EditUserModal({ user, open, onClose, onSuccess, currentUserId }: Props) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionType[]>(
    (user.permissions as PermissionType[]) ?? []
  );
  const [projectAccess, setProjectAccess] = useState<ProjectAccessEntry[]>([]);
  const [tab, setTab] = useState<"info" | "permissions" | "projects">("info");
  const isSelf = user.id === currentUserId;

  const handleSuspend = async () => {
    if (!confirm(`${user.status === "suspended" ? "Reactivate" : "Suspend"} ${user.name}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: user.status === "suspended" ? "active" : "suspended",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(user.status === "suspended" ? "User reactivated." : "User suspended.");
      onSuccess();
    } catch {
      toast.error("Failed to update user.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error();
      toast.success("Permissions updated.");
      onSuccess();
    } catch {
      toast.error("Failed to update permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProjectAccess = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/project-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectAccess }),
      });
      if (!res.ok) throw new Error();
      toast.success("Project access updated.");
      onSuccess();
    } catch {
      toast.error("Failed to update project access.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Team Member" size="lg">
      {/* User header */}
      <div className="px-6 pt-4 pb-4 flex items-center gap-4 border-b border-border">
        <Avatar name={user.name} avatarUrl={user.avatarUrl} size="xl" />
        <div>
          <h3 className="text-base font-semibold text-text-primary">{user.name}</h3>
          <p className="text-sm text-text-secondary">{user.email}</p>
          <div className="mt-1.5">
            <StatusBadge status={user.status} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["info", "permissions", "projects"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "info" ? "Account" : t === "permissions" ? "Permissions" : "Projects"}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-text-muted mb-0.5">Role</p>
                <p className="font-medium capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">Status</p>
                <StatusBadge status={user.status} />
              </div>
              {user.activatedAt && (
                <div>
                  <p className="text-text-muted mb-0.5">Joined</p>
                  <p className="font-medium">{new Date(user.activatedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {!isSelf && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant={user.status === "suspended" ? "secondary" : "danger"}
                  size="sm"
                  onClick={handleSuspend}
                  loading={loading}
                >
                  {user.status === "suspended" ? "Reactivate Account" : "Suspend Account"}
                </Button>
                <p className="text-xs text-text-muted mt-2">
                  {user.status === "suspended"
                    ? "This user cannot log in. Reactivating restores their access."
                    : "Suspended users cannot log in but their data is preserved."}
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "permissions" && (
          <div>
            <p className="text-sm text-text-secondary mb-4">
              {user.role === "admin"
                ? "Admins have full access and bypass all permission checks."
                : "Manage which modules this team member can access."}
            </p>
            <UserPermissionsEditor
              selected={permissions}
              onChange={setPermissions}
              disabled={user.role === "admin"}
            />
            {user.role !== "admin" && (
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSavePermissions} loading={loading}>
                  Save Permissions
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "projects" && (
          <div>
            <p className="text-sm text-text-secondary mb-4">
              Select which projects this person can access and at what level.
            </p>
            <ProjectAccessEditor
              selected={projectAccess}
              onChange={setProjectAccess}
            />
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveProjectAccess} loading={loading}>
                Save Project Access
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
