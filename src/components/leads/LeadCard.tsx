import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { OpportunityBadge } from "@/components/leads/OpportunityBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { formatDate } from "@/lib/utils";
import { LEAD_STATUSES, type LeadStatus, type SavedLead } from "@/types";

interface LeadCardProps {
  savedLead: SavedLead;
  onStatusChange: (status: LeadStatus) => void;
  onRemove: () => void;
}

export function LeadCard({ savedLead, onStatusChange, onRemove }: LeadCardProps) {
  const lead = savedLead.lead;

  return (
    <div className="rounded-card border-border space-y-3 border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/leads/${savedLead.leadId}`} className="text-text-primary truncate font-medium hover:underline">
            {lead?.name ?? "Unknown business"}
          </Link>
          {lead?.category && <p className="text-text-muted text-xs">{lead.category}</p>}
        </div>
        {lead && <OpportunityBadge score={lead.opportunityScore} />}
      </div>

      <Select value={savedLead.status} onValueChange={(value) => onStatusChange(value as LeadStatus)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {savedLead.notes && <p className="text-text-secondary line-clamp-2 text-sm">{savedLead.notes}</p>}

      {savedLead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {savedLead.tags.map((tag) => (
            <Badge key={tag} variant="muted">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {savedLead.followUpDate && (
        <p className="text-text-muted flex items-center gap-1 text-xs">
          <CalendarClock className="size-3.5" />
          Follow up {formatDate(savedLead.followUpDate)}
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}
