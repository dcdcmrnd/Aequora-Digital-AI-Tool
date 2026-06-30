"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Signature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  user: { id: string; name: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}

export function SignatureManager({ open, onClose, currentUserId }: Props) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Signature | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", isDefault: false });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/signatures")
      .then((r) => r.json())
      .then((d) => setSignatures(d.signatures ?? []))
      .catch(() => toast.error("Failed to load signatures."))
      .finally(() => setLoading(false));
  }, [open]);

  const startCreate = () => {
    setEditing(null);
    setForm({ name: "", content: "", isDefault: false });
    setCreating(true);
  };

  const startEdit = (sig: Signature) => {
    setCreating(false);
    setEditing(sig);
    setForm({ name: sig.name, content: sig.content, isDefault: sig.isDefault });
  };

  const cancelForm = () => { setCreating(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Name and content are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/signatures/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Failed to save."); return; }
        setSignatures((prev) => prev.map((s) => s.id === editing.id ? data.signature : s));
        toast.success("Signature updated.");
      } else {
        const res = await fetch("/api/signatures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Failed to create."); return; }
        setSignatures((prev) => [...prev, data.signature]);
        toast.success("Signature created.");
      }
      cancelForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/signatures/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete."); return; }
      setSignatures((prev) => prev.filter((s) => s.id !== id));
      toast.success("Signature deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  if (!open) return null;

  const mySignatures = signatures.filter((s) => s.user.id === currentUserId);
  const teamSignatures = signatures.filter((s) => s.user.id !== currentUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Email Signatures</h2>
            <p className="text-xs text-text-muted mt-0.5">Manage your personal email signatures</p>
          </div>
          <div className="flex items-center gap-2">
            {!creating && !editing && (
              <button
                onClick={startCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-brand-primary/90 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                New Signature
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Create / Edit form */}
          {(creating || editing) && (
            <div className="border border-brand-primary/30 rounded-card p-4 bg-brand-primary/5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">{editing ? "Edit Signature" : "New Signature"}</h3>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Signature Name</label>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. DC Miranda — CEO, Aequora Digital"
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Signature Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  placeholder={"e.g.\nDC Miranda\nCEO, Aequora Digital\ninfo@aequoradigital.com\nwww.aequoradigital.com"}
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none font-mono"
                />
                <p className="text-xs text-text-muted mt-1">Plain text or HTML supported. Line breaks are preserved.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-brand-primary"
                />
                <span className="text-sm text-text-primary">Set as my default signature</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Save Changes" : "Create Signature"}
                </button>
                <button
                  onClick={cancelForm}
                  className="px-4 py-2 border border-border text-sm font-medium rounded-btn hover:bg-surface-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-sm text-text-muted">Loading…</div>
          ) : (
            <>
              {/* My signatures */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">My Signatures</h3>
                {mySignatures.length === 0 ? (
                  <div className="text-sm text-text-muted py-4 text-center border border-dashed border-border rounded-card">
                    No signatures yet. Click "New Signature" to create one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mySignatures.map((sig) => (
                      <SignatureCard
                        key={sig.id}
                        sig={sig}
                        onEdit={() => startEdit(sig)}
                        onDelete={() => handleDelete(sig.id, sig.name)}
                        onPreview={() => setPreview(preview === sig.id ? null : sig.id)}
                        showPreview={preview === sig.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Team signatures (read-only) */}
              {teamSignatures.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Team Signatures</h3>
                  <div className="space-y-2">
                    {teamSignatures.map((sig) => (
                      <SignatureCard
                        key={sig.id}
                        sig={sig}
                        readOnly
                        onPreview={() => setPreview(preview === sig.id ? null : sig.id)}
                        showPreview={preview === sig.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SignatureCard({
  sig, onEdit, onDelete, onPreview, showPreview, readOnly,
}: {
  sig: Signature;
  onEdit?: () => void;
  onDelete?: () => void;
  onPreview: () => void;
  showPreview: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="border border-border rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate">{sig.name}</span>
          {sig.isDefault && (
            <span className="text-xs px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full font-medium flex-shrink-0">Default</span>
          )}
          {readOnly && (
            <span className="text-xs text-text-muted flex-shrink-0">by {sig.user.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onPreview} className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded hover:bg-surface-secondary transition-colors">
            {showPreview ? "Hide" : "Preview"}
          </button>
          {!readOnly && onEdit && (
            <button onClick={onEdit} className="px-2 py-1 text-xs text-brand-primary hover:text-brand-primary/80 border border-border rounded hover:bg-surface-secondary transition-colors">Edit</button>
          )}
          {!readOnly && onDelete && (
            <button onClick={onDelete} className="px-2 py-1 text-xs text-danger hover:text-danger/80 border border-border rounded hover:bg-surface-secondary transition-colors">Delete</button>
          )}
        </div>
      </div>
      {showPreview && (
        <div className="border-t border-border px-4 py-3 bg-surface-secondary/30 text-sm text-text-secondary whitespace-pre-wrap font-sans">
          {sig.content}
        </div>
      )}
    </div>
  );
}
