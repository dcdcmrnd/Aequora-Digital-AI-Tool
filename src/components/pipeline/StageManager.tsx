"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePipeline } from "@/hooks/usePipeline";
import type { Pipeline } from "@/types";

interface StageManagerProps {
  pipeline: Pipeline;
  onClose: () => void;
}

export function StageManager({ pipeline, onClose }: StageManagerProps) {
  const { addStage, renameStage, reorderStage, deleteStage } = usePipeline();
  const [newStageName, setNewStageName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    addStage.mutate({ pipelineId: pipeline.id, name: newStageName.trim() });
    setNewStageName("");
  }

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  function saveEdit() {
    if (editingId && editingName.trim()) {
      renameStage.mutate({ id: editingId, name: editingName.trim() });
    }
    setEditingId(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = stages[index + direction];
    if (!target) return;
    const current = stages[index];
    reorderStage.mutate({ id: current.id, order: target.order });
    reorderStage.mutate({ id: target.id, order: current.order });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this stage? Only possible if it has no opportunities.")) return;
    deleteStage.mutate(id);
  }

  return (
    <div className="rounded-card border border-border bg-white p-4 space-y-3 max-w-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Manage Stages</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center gap-2 rounded-input border border-border px-2 py-1.5">
            <div className="flex flex-col">
              <button
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <ChevronUp className="size-3" />
              </button>
              <button
                onClick={() => move(index, 1)}
                disabled={index === stages.length - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <ChevronDown className="size-3" />
              </button>
            </div>

            {editingId === stage.id ? (
              <Input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="h-7 flex-1"
              />
            ) : (
              <span className="flex-1 text-sm text-text-primary">{stage.name}</span>
            )}

            <button onClick={() => startEdit(stage.id, stage.name)} className="text-text-muted hover:text-brand-primary">
              <Pencil className="size-3.5" />
            </button>
            <button onClick={() => handleDelete(stage.id)} className="text-text-muted hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="New stage name"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!newStageName.trim()}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </form>
    </div>
  );
}
