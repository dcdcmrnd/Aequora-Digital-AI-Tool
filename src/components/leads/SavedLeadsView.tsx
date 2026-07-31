"use client";

import { useMemo, useState } from "react";

import { LeadCard } from "@/components/leads/LeadCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import { LEAD_STATUSES, type LeadStatus } from "@/types";

const STATUS_TABS: Array<LeadStatus | "All"> = ["All", ...LEAD_STATUSES];

export function SavedLeadsView() {
  const { savedLeads, isLoading, updateLead, removeLead } = useSavedLeads();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");

  const filtered = useMemo(() => {
    if (!savedLeads) return [];
    if (statusFilter === "All") return savedLeads;
    return savedLeads.filter((saved) => saved.status === statusFilter);
  }, [savedLeads, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Saved Leads</h1>
        <p className="text-text-muted text-sm">Track and manage the businesses you&apos;ve saved as leads.</p>
      </div>

      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeadStatus | "All")}>
        <TabsList className="h-auto flex-wrap">
          {STATUS_TABS.map((status) => (
            <TabsTrigger key={status} value={status}>
              {status}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((saved) => (
            <LeadCard
              key={saved.id}
              savedLead={saved}
              onStatusChange={(status) => updateLead.mutate({ id: saved.id, status })}
              onRemove={() => removeLead.mutate(saved.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm">
          {statusFilter === "All"
            ? "No saved leads yet. Save businesses from the Leads page."
            : `No leads with status "${statusFilter}".`}
        </p>
      )}
    </div>
  );
}
