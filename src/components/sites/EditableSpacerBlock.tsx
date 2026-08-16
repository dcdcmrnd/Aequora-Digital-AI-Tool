"use client";

import { SpacerBlock } from "@/components/site-blocks/SpacerBlock";
import { Input } from "@/components/ui/Input";
import type { BlockNode } from "@/lib/site-builder/types";

interface EditableSpacerBlockProps {
  block: BlockNode;
  editing: boolean;
  onChange: (height: string) => void;
}

export function EditableSpacerBlock({ block, editing, onChange }: EditableSpacerBlockProps) {
  return (
    <div className="relative">
      {editing && (
        <div className="absolute -top-11 left-0 z-20 flex items-center gap-1.5 rounded-md border border-border bg-white p-1.5 shadow-md" onClick={(e) => e.stopPropagation()}>
          <span className="text-text-muted pl-1 text-xs">Height</span>
          <Input
            value={(block.props.height as string) ?? "40px"}
            onChange={(e) => onChange(e.target.value)}
            placeholder="40px"
            className="h-8 w-20 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <SpacerBlock block={block} />
    </div>
  );
}
