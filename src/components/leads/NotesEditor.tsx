"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface NotesEditorProps {
  initialValue: string | null;
  onSave: (notes: string) => void;
  isSaving?: boolean;
}

export function NotesEditor({ initialValue, onSave, isSaving }: NotesEditorProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const isDirty = value !== (initialValue ?? "");

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={4}
        placeholder="Add notes about this lead..."
      />
      <div className="flex justify-end">
        <Button size="sm" disabled={!isDirty || isSaving} onClick={() => onSave(value)}>
          {isSaving ? "Saving..." : "Save Notes"}
        </Button>
      </div>
    </div>
  );
}
