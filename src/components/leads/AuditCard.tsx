import { CheckCircle2, XCircle } from "lucide-react";

import { ScoreGauge } from "@/components/leads/ScoreGauge";
import { WebsiteStatus } from "@/components/leads/WebsiteStatus";
import { Separator } from "@/components/ui/Separator";
import { formatRelativeTime } from "@/lib/utils";
import type { LeadAudit } from "@/types";

interface AuditCardProps {
  audit: LeadAudit | null | undefined;
  website: string | null;
}

export function AuditCard({ audit, website }: AuditCardProps) {
  if (!website) {
    return (
      <div className="rounded-card border-border border bg-white p-4">
        <h3 className="text-text-primary mb-3 text-sm font-semibold">Website Audit</h3>
        <WebsiteStatus website={null} />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="rounded-card border-border border bg-white p-4">
        <h3 className="text-text-primary mb-1 text-sm font-semibold">Website Audit</h3>
        <p className="text-text-muted text-sm">Not yet audited.</p>
      </div>
    );
  }

  const checks = [
    { label: "HTTPS Enabled", value: audit.httpsEnabled },
    { label: "SSL Valid", value: audit.sslValid },
    { label: "Page Title", value: audit.hasTitle },
    { label: "Meta Description", value: audit.hasMetaDescription },
    { label: "Mobile Friendly", value: audit.mobileFriendly },
  ];

  return (
    <div className="rounded-card border-border border bg-white p-4">
      <h3 className="text-text-primary text-sm font-semibold">Website Audit</h3>
      <p className="text-text-muted mb-4 text-xs">Last scanned {formatRelativeTime(audit.lastScanned)}</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScoreGauge value={audit.performanceScore} label="Performance" />
        <ScoreGauge value={audit.seoScore} label="SEO" />
        <ScoreGauge value={audit.accessibilityScore} label="Accessibility" />
        <ScoreGauge value={audit.bestPracticesScore} label="Best Practices" />
      </div>

      <Separator className="my-4" />

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-sm">
            {check.value ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <XCircle className="text-danger size-4" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
