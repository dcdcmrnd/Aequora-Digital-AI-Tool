"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UserPermissionsEditor } from "./UserPermissionsEditor";
import { ProjectAccessEditor } from "./ProjectAccessEditor";
import { DEFAULT_MEMBER_PERMISSIONS } from "@/lib/permissions";
import type { PermissionType } from "@/types";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProjectAccessEntry {
  projectId: string;
  accessLevel: "viewer" | "contributor" | "manager";
}

const ADMIN_PERMISSIONS: PermissionType[] = [
  "projects.view",
  "projects.create",
  "projects.manage",
  "tasks.view",
  "tasks.create",
  "tasks.manage",
  "notes.view",
  "notes.create",
  "notes.manage",
  "team.view",
  "ai.task_assistant",
  "ai.consultant",
  "admin.users",
  "admin.settings",
];

export function InviteUserModal({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "member" as "admin" | "member",
  });

  const [permissions, setPermissions] = useState<PermissionType[]>(
    DEFAULT_MEMBER_PERMISSIONS as PermissionType[]
  );
  const [projectAccess, setProjectAccess] = useState<ProjectAccessEntry[]>([]);
  const [tab, setTab] = useState<"basic" | "permissions" | "projects">("basic");

  const handleRoleChange = (role: "admin" | "member") => {
    setForm({ ...form, role });
    setPermissions(role === "admin" ? ADMIN_PERMISSIONS : (DEFAULT_MEMBER_PERMISSIONS as PermissionType[]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) {
      toast.error("Email and name are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          role: form.role,
          permissions,
          projectAccess,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create invite.");
        return;
      }

      setInviteUrl(data.inviteUrl);
      setStep("success");
      onSuccess();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite link copied!");
  };

  const handleClose = () => {
    setStep("form");
    setForm({ email: "", name: "", role: "member" });
    setPermissions(DEFAULT_MEMBER_PERMISSIONS as PermissionType[]);
    setProjectAccess([]);
    setTab("basic");
    setInviteUrl("");
    setCopied(false);
    onClose();
  };

  if (step === "success") {
    return (
      <Modal open={open} onClose={handleClose} title="Invite Sent" size="md">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-2">
            Invite created for {form.name}
          </h3>
          <p className="text-sm text-text-secondary mb-6">
            Copy the link below and send it to them. It expires in 72 hours.
          </p>
          <div className="bg-surface-secondary border border-border rounded-input px-3 py-2.5 text-sm text-text-secondary font-mono break-all mb-4">
            {inviteUrl}
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCopy} variant="primary" className="flex-1">
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button onClick={handleClose} variant="secondary" className="flex-1">
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Invite Team Member" size="lg">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["basic", "permissions", "projects"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "basic" ? "Basic Info" : t === "permissions" ? "Permissions" : "Projects"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {tab === "basic" && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Email Address <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="keyssa@aequora.digital"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Display Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Keyssa Luna"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Role
                </label>
                <div className="flex gap-3">
                  {(["member", "admin"] as const).map((r) => (
                    <label
                      key={r}
                      className={`flex-1 flex items-center gap-3 border-2 rounded-card p-3 cursor-pointer transition-colors ${
                        form.role === r
                          ? "border-brand-primary bg-teal-50"
                          : "border-border hover:border-brand-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={form.role === r}
                        onChange={() => handleRoleChange(r)}
                        className="text-brand-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary capitalize">{r}</p>
                        <p className="text-xs text-text-muted">
                          {r === "admin" ? "Full access to everything" : "Access controlled by permissions"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "permissions" && (
            <div>
              <p className="text-sm text-text-secondary mb-4">
                {form.role === "admin"
                  ? "Admins automatically have full access. These permissions are shown for reference."
                  : "Choose which modules this team member can access."}
              </p>
              <UserPermissionsEditor
                selected={permissions}
                onChange={setPermissions}
                disabled={form.role === "admin"}
              />
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
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Send Invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
