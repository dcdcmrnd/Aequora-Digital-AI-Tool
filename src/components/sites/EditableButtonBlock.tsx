"use client";

import { useEffect, useRef } from "react";
import { Link2 } from "lucide-react";

import type { BlockNode } from "@/lib/site-builder/types";

interface EditableButtonBlockProps {
  block: BlockNode;
  editing: boolean;
  onChange: (patch: { label?: string; href?: string }) => void;
}

/**
 * Label is a plain contentEditable span (a button label is a short string, not rich HTML, so a
 * full TipTap instance would be overkill) -- always editable when selected, committing on blur.
 * The link (href) isn't something you can usefully "click into" inline, so it stays a small
 * hover-revealed icon that opens a prompt, same pattern as RichTextEditor's insert-link action.
 */
export function EditableButtonBlock({ block, editing, onChange }: EditableButtonBlockProps) {
  const label = typeof block.props.label === "string" ? block.props.label : "Click here";
  const href = typeof block.props.href === "string" ? block.props.href : "#";
  const labelRef = useRef<HTMLSpanElement>(null);

  // First click only selects the block (editing flips true on the NEXT render); without this,
  // the label wouldn't actually receive a cursor until a second click.
  useEffect(() => {
    if (editing) labelRef.current?.focus();
  }, [editing]);

  function handleEditLink() {
    const url = window.prompt("Button link (https://...)", href === "#" ? "" : href);
    if (url !== null) onChange({ href: url || "#" });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        ref={labelRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onClick={(e) => editing && e.stopPropagation()}
        onBlur={(e) => editing && onChange({ label: e.currentTarget.textContent || "Click here" })}
        style={block.style}
        className="inline-block rounded-md bg-[var(--site-color-primary,#111827)] px-6 py-3 text-[15px] font-semibold text-white outline-none transition-opacity hover:opacity-90"
      >
        {label}
      </span>
      {editing && (
        <button
          type="button"
          title="Edit link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            handleEditLink();
          }}
          className="text-text-muted hover:text-brand-primary rounded-full bg-white p-1.5 shadow-sm"
        >
          <Link2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
