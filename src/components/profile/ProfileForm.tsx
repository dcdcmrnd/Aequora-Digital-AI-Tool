"use client";

import { useState } from "react";
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

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

        <div className="flex items-center gap-4">
          <Avatar name={name} avatarUrl={avatarUrl || null} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{name}</p>
            <p className="text-xs text-text-muted capitalize">{role}</p>
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

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Avatar URL</label>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <p className="text-xs text-text-muted mt-1">Paste a direct image URL, or leave blank to use initials.</p>
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
