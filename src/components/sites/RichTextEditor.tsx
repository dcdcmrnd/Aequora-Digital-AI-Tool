"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Bold, Code2, Image as ImageIcon, Italic, Link2, Underline as UnderlineIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Trimmed version of automation/EmailBodyEditor.tsx's TipTap setup -- same extension family,
// minus the email-specific merge tags/font-color/insert-button tooling this doesn't need.
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [mode, setMode] = useState<"design" | "html">("design");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Image, Link.configure({ openOnClick: false })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none min-h-[120px] px-3 py-2 focus:outline-none" },
    },
    immediatelyRender: false,
  });

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
      if (res.ok && data.url) editor.chain().focus().setImage({ src: data.url }).run();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleInsertLink() {
    if (!editor) return;
    const url = window.prompt("Link URL (https://...)");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const currentBlockType = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : editor?.isActive("heading", { level: 3 })
        ? "h3"
        : "paragraph";

  function handleBlockTypeChange(value: string) {
    if (!editor) return;
    if (value === "paragraph") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  }

  return (
    <div className="rounded-input border border-border bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-secondary px-2 py-1.5">
        <select
          disabled={mode === "html"}
          value={currentBlockType}
          onChange={(e) => handleBlockTypeChange(e.target.value)}
          className="border-border mr-1 rounded border bg-white px-1.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <ToolbarButton title="Bold" active={editor?.isActive("bold")} disabled={mode === "html"} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor?.isActive("italic")} disabled={mode === "html"} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor?.isActive("underline")} disabled={mode === "html"} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Insert link" disabled={mode === "html"} onClick={handleInsertLink}>
          <Link2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Insert image" disabled={mode === "html" || uploading} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="size-3.5" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />

        <div className="ml-auto flex items-center gap-1 text-xs">
          <button type="button" onClick={() => setMode("design")} className={cn("rounded px-2 py-1", mode === "design" ? "text-text-primary bg-white shadow-sm" : "text-text-muted")}>
            Design
          </button>
          <button type="button" onClick={() => setMode("html")} className={cn("flex items-center gap-1 rounded px-2 py-1", mode === "html" ? "text-text-primary bg-white shadow-sm" : "text-text-muted")}>
            <Code2 className="size-3" />
            HTML
          </button>
        </div>
      </div>

      {mode === "design" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          rows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none border-0 px-3 py-2 font-mono text-xs focus:outline-none"
        />
      )}
    </div>
  );
}

function ToolbarButton({ children, onClick, active, disabled, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; title?: string }) {
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
