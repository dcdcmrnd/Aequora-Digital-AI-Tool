"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import toast from "react-hot-toast";

import { ImageBlock } from "@/components/site-blocks/ImageBlock";
import type { BlockNode } from "@/lib/site-builder/types";

interface EditableImageBlockProps {
  block: BlockNode;
  editing: boolean;
  onChange: (patch: { src: string; alt: string; width?: number; height?: number }) => void;
}

function altFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

/** Click-to-replace overlay when selected -- no side panel for src/alt; alt text is derived from the filename automatically. */
export function EditableImageBlock({ block, editing, onChange }: EditableImageBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");

      const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = data.url;
      });

      onChange({ src: data.url, alt: altFromFilename(file.name), width: dims?.width, height: dims?.height });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <ImageBlock block={block} />
      {editing && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-sm font-medium text-white opacity-0 transition-opacity hover:opacity-100 disabled:opacity-100"
        >
          <Upload className="size-4" />
          {uploading ? "Uploading..." : "Replace Image"}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}
