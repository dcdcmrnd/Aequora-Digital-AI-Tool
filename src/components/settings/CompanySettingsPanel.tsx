"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface CompanySettings {
  name: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
}

interface Props {
  initial: CompanySettings;
}

export function CompanySettingsPanel({ initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, SVG, or WebP image.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed."); return; }
      setLogoUrl(data.url);
      toast.success("Logo uploaded.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Company name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, logoUrl, primaryColor }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save."); return; }
      toast.success("Company settings saved.");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="bg-white border border-border rounded-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Company Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-card border border-border bg-surface-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-bold text-brand-primary">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload Logo"}
            </Button>
            {logoUrl && (
              <button
                onClick={() => setLogoUrl("")}
                className="block text-xs text-danger hover:underline"
              >
                Remove logo
              </button>
            )}
            <p className="text-xs text-text-muted">PNG, JPG, SVG or WebP · Max 10MB</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Logo URL</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <p className="text-xs text-text-muted mt-1">Or paste a direct image URL instead of uploading.</p>
        </div>
      </div>

      {/* Company Info */}
      <div className="bg-white border border-border rounded-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Company Information</h2>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Company Name <span className="text-danger">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Company Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Brief description of your company…"
            className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Brand Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded border border-border cursor-pointer"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#0F7B8A"
              className="flex-1 px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
            />
          </div>
          <p className="text-xs text-text-muted mt-1">Used for accents in the workspace interface.</p>
        </div>

        <Button onClick={handleSave} loading={saving}>Save Company Settings</Button>
      </div>
    </div>
  );
}
