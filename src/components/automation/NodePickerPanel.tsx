"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { NODE_CATEGORIES, NODE_DEFINITIONS, PICKABLE_NODE_TYPES, type NodeCategory } from "@/lib/automation/nodeRegistry";
import type { AutomationNodeType } from "@/types";

interface NodePickerPanelProps {
  onPick: (type: AutomationNodeType) => void;
  onClose: () => void;
}

export function NodePickerPanel({ onPick, onClose }: NodePickerPanelProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? PICKABLE_NODE_TYPES.filter(({ type }) => NODE_DEFINITIONS[type].label.toLowerCase().includes(q))
      : PICKABLE_NODE_TYPES;

    const byCategory = new Map<NodeCategory, AutomationNodeType[]>();
    for (const { type, category } of filtered) {
      const list = byCategory.get(category) ?? [];
      list.push(type);
      byCategory.set(category, list);
    }
    return byCategory;
  }, [query]);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">Add a Step</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="text-text-muted pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions..."
            className="border-border w-full rounded-input border py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {grouped.size === 0 && (
          <p className="text-text-muted p-4 text-center text-sm">No matching actions.</p>
        )}
        {NODE_CATEGORIES.filter((cat) => grouped.has(cat)).map((category) => (
          <div key={category} className="mb-3">
            <p className="text-text-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-widest">{category}</p>
            {grouped.get(category)!.map((type) => {
              const def = NODE_DEFINITIONS[type];
              const Icon = def.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onPick(type)}
                  className="hover:bg-surface-secondary flex w-full items-center gap-2.5 rounded-btn px-2 py-2 text-left transition-colors"
                >
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${def.accent}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-text-primary text-sm">{def.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
