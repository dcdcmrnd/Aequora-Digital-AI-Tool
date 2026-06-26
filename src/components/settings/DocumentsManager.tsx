"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface Document {
  id: string;
  name: string;
  description: string | null;
  url: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedBy: { name: string };
}

interface Props {
  initial: Document[];
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return "📄";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📋";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "🗜️";
  return "📄";
}

export function DocumentsManager({ initial }: Props) {
  const [documents, setDocuments] = useState<Document[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!docName.trim()) {
      toast.error("Please enter a document name first.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { toast.error(uploadData.error || "Upload failed."); return; }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName.trim(),
          description: docDesc.trim() || null,
          url: uploadData.url,
          fileSize: file.size,
          mimeType: file.type || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save document."); return; }

      setDocuments((prev) => [{ ...data.document, createdAt: data.document.createdAt }, ...prev]);
      setDocName("");
      setDocDesc("");
      toast.success("Document uploaded.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete."); return; }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success("Document deleted.");
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Upload form */}
      <div className="bg-white border border-border rounded-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Upload Document</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Document Name <span className="text-danger">*</span>
            </label>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Employee Handbook"
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Description (optional)
            </label>
            <input
              value={docDesc}
              onChange={(e) => setDocDesc(e.target.value)}
              placeholder="Brief description…"
              className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="secondary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? "Uploading…" : "Choose File & Upload"}
          </Button>
          <p className="text-xs text-text-muted mt-1.5">PDF, Word, Excel, images and more · Max 10MB</p>
        </div>
      </div>

      {/* Document list */}
      <div className="bg-white border border-border rounded-card divide-y divide-border">
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Documents
            <span className="ml-2 text-xs font-normal text-text-muted">({documents.length})</span>
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="px-5 py-10 text-center text-text-muted text-sm">
            No documents uploaded yet.
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 px-5 py-4">
              <span className="text-xl flex-shrink-0 mt-0.5">{getFileIcon(doc.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-text-primary hover:text-brand-primary truncate block"
                >
                  {doc.name}
                </a>
                {doc.description && (
                  <p className="text-xs text-text-secondary mt-0.5 truncate">{doc.description}</p>
                )}
                <p className="text-xs text-text-muted mt-0.5">
                  {formatBytes(doc.fileSize)}
                  {doc.fileSize ? " · " : ""}
                  Uploaded by {doc.uploadedBy.name} ·{" "}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-primary hover:underline"
                >
                  View
                </a>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="text-xs text-danger hover:underline disabled:opacity-50"
                >
                  {deletingId === doc.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
