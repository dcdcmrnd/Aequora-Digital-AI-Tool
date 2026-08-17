"use client";

import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";

import { useCall } from "@/lib/callStore";

/** Header "dial any number" button — for calling numbers that aren't saved as a contact. */
export function DialpadButton() {
  const { startCall } = useCall();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleCall = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = number.trim();
    if (!phone) return;
    startCall({ name: phone, phone });
    setOpen(false);
    setNumber("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-btn transition-colors"
        aria-label="Call a number"
        title="Call a number"
      >
        <Phone className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white border border-border rounded-card shadow-xl z-50 p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Call a number</h3>
          <form onSubmit={handleCall} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="flex-1 min-w-0 rounded-btn border border-border px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
            <button
              type="submit"
              disabled={!number.trim()}
              className="flex-shrink-0 flex items-center justify-center size-8 rounded-btn bg-brand-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-primary/90 transition-colors"
              aria-label="Call"
            >
              <Phone className="size-4" />
            </button>
          </form>
          <p className="text-xs text-text-muted mt-2">Not on your contact list? No problem — dial any number.</p>
        </div>
      )}
    </div>
  );
}
