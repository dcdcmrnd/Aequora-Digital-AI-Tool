"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Bold, Image as ImageIcon, Italic, Link2, Underline as UnderlineIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  html: string;
  onChange: (html: string) => void;
  /** Called once on blur/click-away, after the final onChange -- lets the caller exit edit mode. */
  onDone?: () => void;
  autoFocus?: boolean;
}

/**
 * True inline editing: mounted directly in place of a block's static rendering (see
 * EditableTextBlock.tsx), styled to match .site-content exactly so there's no visual jump
 * between "not editing" and "editing" -- only a small floating toolbar above it gives it away.
 * Lazily mounted (one instance, only for whichever block is currently selected/being edited) per
 * this session's research: many simultaneous TipTap/ProseMirror instances is untested territory
 * in this codebase, so only ever one is live at a time.
 */
export function RichTextEditor({ html, onChange, onDone, autoFocus }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Image, Link.configure({ openOnClick: false })],
    content: html,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "site-content outline-none" } },
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
  });

  // Deliberately NOT TipTap's own onBlur lifecycle hook -- that fires whenever the contentEditable
  // itself loses focus, including when focus moves to THIS component's own toolbar (a button or
  // the heading select), which would exit edit mode mid-format. Instead, a single onBlur on the
  // outer container (React's onBlur bubbles, unlike native focusout... it's actually built on
  // focusout, which does bubble) checks relatedTarget -- only treat it as "really done" if focus
  // landed outside this whole container, not on a toolbar control within it.
  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node | null)) onDone?.();
  }

  // Uncontrolled internally -- only re-sync if the external value diverges for a reason other
  // than this editor's own typing (e.g. switching which block is selected).
  useEffect(() => {
    if (editor && html !== editor.getHTML()) editor.commands.setContent(html, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

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
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()} onBlur={handleContainerBlur}>
      <div className="absolute -top-10 left-0 z-20 flex items-center gap-0.5 rounded-md border border-border bg-white px-1 py-1 shadow-md">
        <select
          value={currentBlockType}
          onChange={(e) => handleBlockTypeChange(e.target.value)}
          className="border-border mr-0.5 rounded border bg-white px-1 py-1 text-xs"
        >
          <option value="paragraph">Text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <ToolbarButton title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Insert link" onClick={handleInsertLink}>
          <Link2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Insert image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="size-3.5" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
      </div>

      <div className="rounded-md ring-2 ring-brand-primary/40">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ children, onClick, active, disabled, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      // Without this, clicking a toolbar button blurs the contentEditable FIRST (buttons steal
      // focus on mousedown), which fires the editor's onBlur/onDone before the click's format
      // action even applies -- exiting edit mode mid-click. preventDefault on mousedown keeps
      // focus (and the current text selection) in the editor throughout the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "text-text-secondary rounded px-1.5 py-1 text-xs hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50",
        active && "text-brand-primary bg-surface-secondary",
      )}
    >
      {children}
    </button>
  );
}
