"use client";

import { useState, useEffect } from "react";

export function DailyBriefingWidget() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/briefing")
      .then((r) => r.json())
      .then((d) => setBriefing(d.briefing ?? null))
      .catch(() => setBriefing(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-brand-dark to-[#0d3d6e] rounded-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white/90">AI Daily Briefing</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        </div>
        <div className="h-4 bg-white/10 rounded animate-pulse w-3/4 mb-2" />
        <div className="h-4 bg-white/10 rounded animate-pulse w-full mb-2" />
        <div className="h-4 bg-white/10 rounded animate-pulse w-2/3" />
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="bg-gradient-to-br from-brand-dark to-[#0d3d6e] rounded-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-brand-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">AI Daily Briefing</span>
      </div>
      <p className="text-sm text-white/90 leading-relaxed">{briefing}</p>
    </div>
  );
}
