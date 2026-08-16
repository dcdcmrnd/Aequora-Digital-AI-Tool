"use client";

import { TextBlock } from "@/components/site-blocks/TextBlock";
import type { BlockNode } from "@/lib/site-builder/types";
import { RichTextEditor } from "./RichTextEditor";

interface EditableTextBlockProps {
  block: BlockNode;
  editing: boolean;
  onChange: (html: string) => void;
  onDone: () => void;
}

/** Static rendering when not selected (cheap, matches the public page exactly); a live TipTap instance only while actively selected/being edited -- see RichTextEditor.tsx for why only one is ever mounted at a time. */
export function EditableTextBlock({ block, editing, onChange, onDone }: EditableTextBlockProps) {
  if (!editing) return <TextBlock block={block} />;

  const html = typeof block.props.html === "string" ? block.props.html : "";
  return (
    <div style={block.style}>
      <RichTextEditor html={html} onChange={onChange} onDone={onDone} autoFocus />
    </div>
  );
}
