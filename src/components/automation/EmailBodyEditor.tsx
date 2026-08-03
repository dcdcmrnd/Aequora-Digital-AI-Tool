"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Bold, Code2, Image as ImageIcon, Italic, Link2, Palette, Underline as UnderlineIcon } from "lucide-react";

import { Dropdown } from "@/components/ui/Dropdown";
import { Textarea } from "@/components/ui/Textarea";
import { CONTACT_MERGE_TAGS } from "@/lib/automation/mergeTags";
import { cn } from "@/lib/utils";

// Extends Link to preserve an inline `style` attribute, so "Insert Button"
// can produce a real styled CTA button (a link is the only email-safe way
// to make a clickable button) that survives round-tripping through the editor.
const StyledLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
        renderHTML: (attributes: { style?: string | null }) => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
});

const BUTTON_STYLE =
  "display:inline-block;background-color:#0F7B8A;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;";

const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Large", value: "18px" },
  { label: "X-Large", value: "24px" },
  { label: "Huge", value: "32px" },
];

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function EmailBodyEditor({ value, onChange }: EmailBodyEditorProps) {
  const [mode, setMode] = useState<"design" | "html">("design");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      TextStyle,
      Color,
      FontSize,
      Image,
      StyledLink.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none min-h-[160px] px-3 py-2 focus:outline-none" },
    },
    immediatelyRender: false,
  });

  // Re-sync the editor when switching back from raw-HTML mode, since the
  // textarea in that mode edits `value` directly without going through TipTap.
  useEffect(() => {
    if (!editor || mode !== "design") return;
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editor]);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleInsertButton() {
    if (!editor) return;
    const text = window.prompt("Button text");
    if (!text) return;
    const url = window.prompt("Button link (https://...)");
    if (!url) return;
    editor
      .chain()
      .focus()
      .insertContent(`<a href="${escapeHtml(url)}" style="${BUTTON_STYLE}">${escapeHtml(text)}</a>&nbsp;`)
      .run();
  }

  function handleInsertLink() {
    if (!editor) return;
    const url = window.prompt("Link URL (https://...)");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rounded-input border border-border bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-secondary px-2 py-1.5">
        <ToolbarButton
          title="Bold"
          active={editor?.isActive("bold")}
          disabled={mode === "html"}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor?.isActive("italic")}
          disabled={mode === "html"}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor?.isActive("underline")}
          disabled={mode === "html"}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>

        <label
          className={cn("flex cursor-pointer items-center gap-1 px-1", mode === "html" && "pointer-events-none opacity-50")}
          title="Font color"
        >
          <Palette className="text-text-muted size-3.5" />
          <input
            type="color"
            disabled={mode === "html"}
            onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
            className="size-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <select
          disabled={mode === "html"}
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            editor?.chain().focus().setFontSize(e.target.value).run();
            e.target.value = "";
          }}
          className="border-border rounded border bg-white px-1 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <ToolbarButton title="Insert link" disabled={mode === "html"} onClick={handleInsertLink}>
          <Link2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Insert button" disabled={mode === "html"} onClick={handleInsertButton}>
          Button
        </ToolbarButton>
        <ToolbarButton title="Insert image" disabled={mode === "html" || uploading} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="size-3.5" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />

        <Dropdown
          align="left"
          trigger={
            <button
              type="button"
              disabled={mode === "html"}
              className="text-text-secondary rounded px-1.5 py-1 text-xs hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Custom value
            </button>
          }
          items={CONTACT_MERGE_TAGS.map((tag) => ({
            label: tag.label,
            onClick: () => editor?.chain().focus().insertContent(tag.token).run(),
          }))}
        />

        <div className="ml-auto flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("design")}
            className={cn("rounded px-2 py-1", mode === "design" ? "text-text-primary bg-white shadow-sm" : "text-text-muted")}
          >
            Design
          </button>
          <button
            type="button"
            onClick={() => setMode("html")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1",
              mode === "html" ? "text-text-primary bg-white shadow-sm" : "text-text-muted",
            )}
          >
            <Code2 className="size-3" />
            HTML
          </button>
        </div>
      </div>

      {mode === "design" ? (
        <EditorContent editor={editor} />
      ) : (
        <Textarea
          rows={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-none border-0 font-mono text-xs focus-visible:ring-0"
        />
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-text-secondary rounded px-1.5 py-1 text-xs hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
        active && "text-brand-primary bg-white shadow-sm",
      )}
    >
      {children}
    </button>
  );
}
