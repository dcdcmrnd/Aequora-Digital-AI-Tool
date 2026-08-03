"use client";

import { useMemo, useState } from "react";
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
  /** Existing tags (e.g. from across all contacts) offered as a dropdown while typing. */
  suggestions?: string[];
}

/**
 * Chip-based tag editor: type, press Enter (or comma) to commit a tag.
 * Tags are normalized to lowercase and deduped case-insensitively so
 * "Team" and "team" can't both exist as separate tags. When `suggestions`
 * is provided, matching existing tags are offered in a dropdown so reusing
 * one doesn't require typing it exactly.
 */
export function TagInput({ tags, onChange, placeholder = "Add tag…", className, suggestions }: TagInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    if (!suggestions) return [];
    const q = normalizeTag(input);
    return suggestions
      .filter((s) => !tags.includes(s))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, input, tags]);

  function commitTag(raw: string) {
    const normalized = normalizeTag(raw);
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
      commitTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  const showDropdown = focused && matches.length > 0;

  return (
    <div className="relative">
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
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Deferred so a suggestion's onMouseDown can preventDefault and
            // fire its click before this blur would otherwise close the list.
            setTimeout(() => setFocused(false), 100);
            commitTag(input);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[100px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-card border border-border bg-white shadow-lg">
          {matches.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commitTag(tag);
              }}
              className="hover:bg-surface-secondary block w-full px-3 py-1.5 text-left text-sm text-text-primary"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
