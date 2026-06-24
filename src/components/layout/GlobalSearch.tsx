"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";

type SearchItem =
  | { type: "task"; id: string; title: string; status: string; priority: string; projectId: string; project?: { name: string; color: string } }
  | { type: "note"; id: string; title: string; content: string; updatedAt: string; category?: { name: string; color: string } }
  | { type: "project"; id: string; name: string; description: string | null; status: string; color: string };

interface SearchData {
  tasks: Extract<SearchItem, { type: "task" }>[];
  notes: Extract<SearchItem, { type: "note" }>[];
  projects: Extract<SearchItem, { type: "project" }>[];
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchData | null>(null);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load search data once when opened
  useEffect(() => {
    if (open && !data) {
      fetch("/api/search")
        .then((r) => r.json())
        .then(setData)
        .catch(console.error);
    }
  }, [open, data]);

  // Run Fuse search when query or data changes
  useEffect(() => {
    if (!data || !query.trim()) { setResults([]); return; }

    const all: SearchItem[] = [
      ...data.tasks,
      ...data.notes,
      ...data.projects,
    ];

    const fuse = new Fuse(all, {
      keys: [
        { name: "title", weight: 2 },
        { name: "name", weight: 2 },
        { name: "content", weight: 0.5 },
        { name: "description", weight: 0.5 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    const hits = fuse.search(query, { limit: 12 });
    setResults(hits.map((h) => h.item));
    setSelectedIndex(0);
  }, [query, data]);

  const navigate = useCallback((item: SearchItem) => {
    setOpen(false);
    setQuery("");
    if (item.type === "task") router.push(`/projects/${item.projectId}`);
    else if (item.type === "note") router.push(`/notes/${item.id}`);
    else router.push(`/projects/${item.id}`);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIndex]) { navigate(results[selectedIndex]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const getItemLabel = (item: SearchItem) => {
    if (item.type === "task") return item.title;
    if (item.type === "note") return item.title;
    return item.name;
  };

  const getItemMeta = (item: SearchItem) => {
    if (item.type === "task") return item.project?.name ?? "Task";
    if (item.type === "note") return item.category?.name ?? "Note";
    return item.status;
  };

  const getTypeIcon = (type: string) => {
    if (type === "task") return "✓";
    if (type === "note") return "📝";
    return "📁";
  };

  const getTypePill = (type: string) => {
    if (type === "task") return "bg-blue-100 text-blue-700";
    if (type === "note") return "bg-amber-100 text-amber-700";
    return "bg-teal-100 text-teal-700";
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-border rounded-input text-sm text-text-muted cursor-text hover:border-brand-primary/40 transition-colors w-56"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="flex-1">Search…</span>
        <kbd className="hidden sm:inline-flex text-[10px] border border-border rounded px-1 py-0.5 font-mono">⌘K</kbd>
      </div>

      {open && (
        <div className="absolute top-0 left-0 w-full z-50">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, notes, projects…"
            className="w-full px-3 py-1.5 bg-white border border-brand-primary rounded-input text-sm focus:outline-none shadow-lg"
          />
          {query.trim() && (
            <div className="absolute top-full left-0 w-80 bg-white border border-border rounded-card shadow-xl mt-1 overflow-hidden">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-sm text-text-muted text-center">No results for "{query}"</p>
              ) : (
                <ul>
                  {results.map((item, i) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigate(item)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i === selectedIndex ? "bg-surface-secondary" : "hover:bg-surface-hover"}`}
                    >
                      <span className="text-base flex-shrink-0">{getTypeIcon(item.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{getItemLabel(item)}</p>
                        <p className="text-xs text-text-muted truncate">{getItemMeta(item)}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase ${getTypePill(item.type)}`}>
                        {item.type}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
