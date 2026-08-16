"use client";

import { useState } from "react";
import { Copy, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { BLOCK_DEFINITIONS } from "@/lib/site-builder/blockRegistry";
import type { BlockNode } from "@/lib/site-builder/types";

// Only ever shown for container blocks (section/columns/column) -- everything else (text,
// button, image, video, spacer) is edited directly on the canvas now (see the Editable*Block
// components), so this only needs to cover layout-level style, not per-block content forms.
interface BlockConfigPanelProps {
  block: BlockNode;
  onClose: () => void;
  onSave: (patch: Partial<Pick<BlockNode, "style">>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function BlockConfigPanel({ block, onClose, onSave, onDelete, onDuplicate }: BlockConfigPanelProps) {
  const [style, setStyle] = useState<Record<string, string>>(block.style ?? {});

  function setStyleProp(key: string, value: string) {
    setStyle((prev) => (value ? { ...prev, [key]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key))));
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">{BLOCK_DEFINITIONS[block.type].label} Style</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <StyleFields style={style} setStyleProp={setStyleProp} />
      </div>

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
        <Button onClick={() => onSave({ style })}>Save</Button>
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

const TEXT_ALIGN_OPTIONS = ["left", "center", "right"] as const;

function StyleFields({ style, setStyleProp }: { style: Record<string, string>; setStyleProp: (key: string, value: string) => void }) {
  return (
    <>
      <Field label="Background">
        <Input type="color" value={style.backgroundColor || "#ffffff"} onChange={(e) => setStyleProp("backgroundColor", e.target.value)} className="h-9 p-1" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Padding">
          <Input value={style.padding ?? ""} onChange={(e) => setStyleProp("padding", e.target.value)} placeholder="e.g. 48px 24px" />
        </Field>
        <Field label="Margin">
          <Input value={style.margin ?? ""} onChange={(e) => setStyleProp("margin", e.target.value)} placeholder="e.g. 0 0 16px" />
        </Field>
      </div>
      <Field label="Content align">
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
      <Field label="Corner radius">
        <Input value={style.borderRadius ?? ""} onChange={(e) => setStyleProp("borderRadius", e.target.value)} placeholder="e.g. 8px" />
      </Field>
    </>
  );
}
