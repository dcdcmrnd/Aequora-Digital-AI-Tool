"use client";

import { useRef, useState } from "react";
import { Copy, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import type { BlockNode } from "@/lib/site-builder/types";
import { RichTextEditor } from "./RichTextEditor";

interface BlockConfigPanelProps {
  block: BlockNode;
  onClose: () => void;
  onSave: (patch: Partial<Pick<BlockNode, "props" | "style">>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddInside?: () => void;
}

export function BlockConfigPanel({ block, onClose, onSave, onDelete, onDuplicate, onAddInside }: BlockConfigPanelProps) {
  const [props, setProps] = useState<Record<string, unknown>>(block.props);
  const [style, setStyle] = useState<Record<string, string>>(block.style ?? {});

  function setProp(key: string, value: unknown) {
    setProps((prev) => ({ ...prev, [key]: value }));
  }
  function setStyleProp(key: string, value: string) {
    setStyle((prev) => (value ? { ...prev, [key]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key))));
  }

  function handleSave() {
    onSave({ props, style });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">{BLOCK_DEFINITIONS[block.type].label}</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="content" className="space-y-4">
            <ContentFields block={block} props={props} setProp={setProp} onAddInside={onAddInside} />
          </TabsContent>
          <TabsContent value="style" className="space-y-4">
            <StyleFields style={style} setStyleProp={setStyleProp} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex items-center justify-between border-t border-border p-4">
        <div className="flex gap-2">
          <Button variant="ghost" className="text-danger" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button variant="ghost" onClick={onDuplicate} title="Insert a copy of this block right after it">
            <Copy className="size-4" />
            Duplicate
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-text-secondary text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function ContentFields({
  block,
  props,
  setProp,
  onAddInside,
}: {
  block: BlockNode;
  props: Record<string, unknown>;
  setProp: (key: string, value: unknown) => void;
  onAddInside?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");

      // Capture intrinsic size so ImageBlock.tsx can render via next/image (optimized) instead
      // of a plain <img> -- see the comment there.
      const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = data.url;
      });

      setProp("src", data.url);
      if (dims) {
        setProp("width", dims.width);
        setProp("height", dims.height);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  switch (block.type) {
    case "section":
      return (
        <div className="space-y-3">
          <p className="text-text-secondary text-sm">Add blocks inside this section, then drag to reorder them.</p>
          {onAddInside && (
            <Button type="button" variant="secondary" size="sm" onClick={onAddInside}>
              Add Block Inside
            </Button>
          )}
        </div>
      );

    case "text":
      return (
        <Field label="Text">
          <RichTextEditor value={(props.html as string) ?? ""} onChange={(html) => setProp("html", html)} />
        </Field>
      );

    case "button":
      return (
        <>
          <Field label="Label">
            <Input value={(props.label as string) ?? ""} onChange={(e) => setProp("label", e.target.value)} />
          </Field>
          <Field label="Link URL">
            <Input value={(props.href as string) ?? ""} onChange={(e) => setProp("href", e.target.value)} placeholder="https://..." />
          </Field>
        </>
      );

    case "image":
      return (
        <>
          <Field label="Image">
            <div className="space-y-2">
              {typeof props.src === "string" && props.src && (
                // eslint-disable-next-line @next/next/no-img-element -- preview thumbnail only
                <img src={props.src} alt="" className="max-h-32 rounded border border-border object-contain" />
              )}
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                {props.src ? "Replace image" : "Upload image"}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          </Field>
          <Field label="Alt text">
            <Input value={(props.alt as string) ?? ""} onChange={(e) => setProp("alt", e.target.value)} placeholder="Describes the image" />
          </Field>
        </>
      );

    case "video":
      return (
        <Field label="Video URL">
          <Input value={(props.url as string) ?? ""} onChange={(e) => setProp("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." />
        </Field>
      );

    case "spacer":
      return (
        <Field label="Height">
          <Input value={(props.height as string) ?? "40px"} onChange={(e) => setProp("height", e.target.value)} placeholder="40px" />
        </Field>
      );

    default:
      return null;
  }
}

const TEXT_ALIGN_OPTIONS = ["left", "center", "right"] as const;
const FONT_WEIGHT_OPTIONS = [
  { value: "400", label: "Normal" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
];

function StyleFields({ style, setStyleProp }: { style: Record<string, string>; setStyleProp: (key: string, value: string) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Background">
          <Input type="color" value={style.backgroundColor || "#ffffff"} onChange={(e) => setStyleProp("backgroundColor", e.target.value)} className="h-9 p-1" />
        </Field>
        <Field label="Text color">
          <Input type="color" value={style.color || "#000000"} onChange={(e) => setStyleProp("color", e.target.value)} className="h-9 p-1" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Padding">
          <Input value={style.padding ?? ""} onChange={(e) => setStyleProp("padding", e.target.value)} placeholder="e.g. 24px" />
        </Field>
        <Field label="Margin">
          <Input value={style.margin ?? ""} onChange={(e) => setStyleProp("margin", e.target.value)} placeholder="e.g. 0 0 16px" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Text align">
          <Select value={style.textAlign || "left"} onValueChange={(v) => setStyleProp("textAlign", v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_ALIGN_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v[0].toUpperCase() + v.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Font weight">
          <Select value={style.fontWeight || "400"} onValueChange={(v) => setStyleProp("fontWeight", v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Font size">
        <Input value={style.fontSize ?? ""} onChange={(e) => setStyleProp("fontSize", e.target.value)} placeholder="e.g. 16px" />
      </Field>
      <Field label="Corner radius">
        <Input value={style.borderRadius ?? ""} onChange={(e) => setStyleProp("borderRadius", e.target.value)} placeholder="e.g. 8px" />
      </Field>
    </>
  );
}
