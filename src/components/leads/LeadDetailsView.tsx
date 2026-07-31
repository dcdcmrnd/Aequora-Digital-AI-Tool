"use client";

import { useState } from "react";
import { Bookmark, ExternalLink, MapPin, Phone, RefreshCw } from "lucide-react";

import { AuditCard } from "@/components/leads/AuditCard";
import { NotesEditor } from "@/components/leads/NotesEditor";
import { OpportunityBadge } from "@/components/leads/OpportunityBadge";
import { WebsiteStatus } from "@/components/leads/WebsiteStatus";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useLeadAudit } from "@/hooks/useLeadAudit";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import { cn, formatDate } from "@/lib/utils";
import { LEAD_STATUSES, type Lead, type LeadStatus, type SavedLead } from "@/types";

interface LeadDetailsViewProps {
  lead: Lead;
  initialSavedLead: SavedLead | null;
}

export function LeadDetailsView({ lead: initialLead, initialSavedLead }: LeadDetailsViewProps) {
  const audit = useLeadAudit(initialLead.id);
  const savedLeads = useSavedLeads();
  const [lead, setLead] = useState(initialLead);
  const [savedLead, setSavedLead] = useState(initialSavedLead);

  const mapHref =
    lead.lat !== null && lead.lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}`
      : lead.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`
        : null;

  function handleSave() {
    savedLeads.saveLead.mutate({ leadId: lead.id }, { onSuccess: (data) => setSavedLead(data.savedLead) });
  }

  function handleStatusChange(status: LeadStatus) {
    if (!savedLead) return;
    savedLeads.updateLead.mutate({ id: savedLead.id, status }, { onSuccess: (data) => setSavedLead(data.savedLead) });
  }

  function handleSaveNotes(notes: string) {
    if (!savedLead) return;
    savedLeads.updateLead.mutate({ id: savedLead.id, notes }, { onSuccess: (data) => setSavedLead(data.savedLead) });
  }

  const timeline = [
    { label: "Discovered", date: lead.createdAt },
    ...(lead.audit ? [{ label: "Website audited", date: lead.audit.lastScanned }] : []),
    ...(savedLead ? [{ label: "Saved as lead", date: savedLead.createdAt }] : []),
    ...(savedLead && savedLead.updatedAt !== savedLead.createdAt
      ? [{ label: "Lead updated", date: savedLead.updatedAt }]
      : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">{lead.name}</h1>
          {lead.category && <p className="text-text-muted text-sm">{lead.category}</p>}
        </div>
        <OpportunityBadge score={lead.opportunityScore} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-card border-border border bg-white p-4">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">Business Information</h3>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Phone className="text-text-muted size-4" />
                {lead.phone ?? "—"}
              </div>
              <div>
                <WebsiteStatus website={lead.website} httpsEnabled={lead.audit?.httpsEnabled} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="text-text-muted size-4 shrink-0" />
                {lead.address ?? "—"}
                {mapHref && (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary inline-flex items-center gap-1 hover:underline"
                  >
                    View on map <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-text-primary text-lg font-semibold">Audit Results</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => audit.mutate(undefined, { onSuccess: (data) => setLead(data.lead) })}
              disabled={audit.isPending || !lead.website}
            >
              <RefreshCw className={cn("size-3.5", audit.isPending && "animate-spin")} />
              {audit.isPending ? "Auditing..." : "Re-run Audit"}
            </Button>
          </div>
          <AuditCard audit={lead.audit} website={lead.website} />

          <div className="rounded-card border-border border bg-white p-4">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">Timeline</h3>
            <ol className="space-y-3">
              {timeline.map((event) => (
                <li key={`${event.label}-${event.date}`} className="flex items-center gap-3 text-sm">
                  <span className="bg-brand-primary size-1.5 shrink-0 rounded-full" />
                  <span className="text-text-muted">{formatDate(event.date)}</span>
                  <span className="text-text-primary">{event.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-card border-border border bg-white p-4">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">Lead Status</h3>
            {savedLead ? (
              <Select value={savedLead.status} onValueChange={(value) => handleStatusChange(value as LeadStatus)}>
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
            ) : (
              <Button className="w-full" onClick={handleSave} disabled={savedLeads.saveLead.isPending}>
                <Bookmark className="size-4" />
                Save Lead
              </Button>
            )}
          </div>

          {savedLead && (
            <div className="rounded-card border-border border bg-white p-4">
              <h3 className="text-text-primary mb-3 text-sm font-semibold">Notes</h3>
              <NotesEditor
                initialValue={savedLead.notes}
                onSave={handleSaveNotes}
                isSaving={savedLeads.updateLead.isPending}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
