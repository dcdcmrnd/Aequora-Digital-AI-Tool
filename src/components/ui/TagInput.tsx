"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Chip-based tag editor: type, press Enter (or comma) to commit a tag.
 * Tags are normalized to lowercase and deduped case-insensitively so
 * "Team" and "team" can't both exist as separate tags.
 */
export function TagInput({ tags, onChange, placeholder = "Add tag…", className }: TagInputProps) {
  const [input, setInput] = useState("");

  function addTag() {
    const normalized = normalizeTag(input);
    if (!normalized || tags.includes(normalized)) {
      setInput("");
      return;
    }
    onChange([...tags, normalized]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-input border border-border bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand-primary",
        className,
      )}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="text-text-muted hover:text-danger">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[100px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
      />
    </div>
  );
}
