"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MailOpen, MailX, MessageCircle, Send } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmailStats {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  replied: number;
  bounceRate: number;
  deliveredRate: number;
  openRate: number;
  replyRate: number;
}

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function EmailReportingView() {
  const [range, setRange] = useState<string>("30");
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reporting/email?days=${range}`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Reporting</h1>
          <p className="text-text-muted text-sm">Outreach delivery, opens, and replies across every email sent.</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="border-border rounded-btn border bg-white px-3 py-1.5 text-sm"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : !stats ? (
        <p className="text-text-muted text-sm">Couldn&apos;t load reporting data.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Send} label="Sent" value={stats.sent} accent="text-brand-primary bg-brand-primary/10" />
          <StatCard
            icon={CheckCircle2}
            label="Delivered"
            value={stats.delivered}
            rate={stats.deliveredRate}
            accent="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            icon={MailX}
            label="Bounced"
            value={stats.bounced}
            rate={stats.bounceRate}
            accent="text-danger bg-red-50"
          />
          <StatCard
            icon={MailOpen}
            label="Opened"
            value={stats.opened}
            rate={stats.openRate}
            accent="text-blue-600 bg-blue-50"
          />
          <StatCard
            icon={MessageCircle}
            label="Replied"
            value={stats.replied}
            rate={stats.replyRate}
            accent="text-purple-600 bg-purple-50"
          />
        </div>
      )}

      <p className="text-text-muted text-xs">
        Bounce and reply detection run once a day (Vercel Hobby-plan cron limit), so today&apos;s sends won&apos;t
        show a final bounce/reply picture until the next daily check.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  rate,
  accent,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  rate?: number;
  accent: string;
}) {
  return (
    <div className="rounded-card border-border border bg-white p-4">
      <div className={cn("mb-3 flex size-9 items-center justify-center rounded-full", accent)}>
        <Icon className="size-4" />
      </div>
      <p className="text-text-primary text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-text-muted text-xs">
        {label}
        {rate !== undefined && <span className="ml-1.5">· {formatPercent(rate)}</span>}
      </p>
    </div>
  );
}
