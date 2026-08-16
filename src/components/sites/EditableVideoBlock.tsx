"use client";

import { VideoBlock } from "@/components/site-blocks/VideoBlock";
import { Input } from "@/components/ui/Input";
import type { BlockNode } from "@/lib/site-builder/types";

interface EditableVideoBlockProps {
  block: BlockNode;
  editing: boolean;
  onChange: (url: string) => void;
}

export function EditableVideoBlock({ block, editing, onChange }: EditableVideoBlockProps) {
  return (
    <div className="relative">
      {editing && (
        <div className="absolute -top-11 left-0 z-20 flex w-72 items-center gap-1 rounded-md border border-border bg-white p-1.5 shadow-md" onClick={(e) => e.stopPropagation()}>
          <Input
            value={(block.props.url as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="h-8 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <VideoBlock block={block} />
    </div>
  );
}
