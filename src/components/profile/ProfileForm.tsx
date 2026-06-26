"use client";

import { useState, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface Props {
  initialName: string;
  initialAvatarUrl: string;
  email: string;
  role: string;
}

export function ProfileForm({ initialName, initialAvatarUrl, email, role }: Props) {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, WebP, or GIF image.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed."); return; }
      setAvatarUrl(data.url);
      toast.success("Photo uploaded. Save changes to apply.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save."); return; }
      toast.success("Profile updated. Changes take effect on next sign-in.");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match."); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to change password."); return; }
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <div className="bg-white border border-border rounded-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Profile Information</h2>

        {/* Avatar upload */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <Avatar name={name} avatarUrl={avatarUrl || null} size="lg" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity"
              title="Upload photo"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{name || "—"}</p>
            <p className="text-xs text-text-muted capitalize mb-2">{role}</p>
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload Photo"}
            </Button>
            {avatarUrl && (
              <button
                onClick={() => setAvatarUrl("")}
                className="ml-2 text-xs text-danger hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
          <input
            value={email}
            disabled
            className="w-full px-3 py-2 border border-border rounded-input text-sm bg-surface-secondary text-text-muted cursor-not-allowed"
          />
          <p className="text-xs text-text-muted mt-1">Contact an admin to change your email.</p>
        </div>

        <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
      </div>

      {/* Password change */}
      <div className="bg-white border border-border rounded-card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <Button type="submit" loading={savingPassword}>Update Password</Button>
        </form>
      </div>
    </div>
  );
}
