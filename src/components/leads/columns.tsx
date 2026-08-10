"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BookUser, CheckCircle2, Star } from "lucide-react";

import { OpportunityBadge } from "@/components/leads/OpportunityBadge";
import { ScoreGauge } from "@/components/leads/ScoreGauge";
import { WebsiteStatus } from "@/components/leads/WebsiteStatus";
import { CallButton } from "@/components/calls/CallWidget";
import { Button } from "@/components/ui/Button";
import type { Lead } from "@/types";

export type LeadSortKey = "rating" | "reviewCount" | "email" | "opportunityScore";
/** Broader than LeadSortKey — the "Newest" (createdAt) option is only reachable via the
    Sort By dropdown, not a clickable header, but still needs to compare against it here. */
export type LeadActiveSortBy = LeadSortKey | "createdAt";

interface ServerSortableHeaderProps {
  label: string;
  sortKey: LeadSortKey;
  activeSortBy?: string;
  activeSortDirection?: "asc" | "desc";
  onSort: (key: LeadSortKey) => void;
}

/**
 * Unlike tanstack's own column sorting (which only reorders the current
 * page's rows), clicking this re-queries the backend across the whole
 * filtered result set — sorting has to happen server-side since results are
 * server-paginated.
 */
function ServerSortableHeader({ label, sortKey, activeSortBy, activeSortDirection, onSort }: ServerSortableHeaderProps) {
  const isActive = activeSortBy === sortKey;
  return (
    <Button variant="ghost" size="sm" className="-ml-3" onClick={() => onSort(sortKey)}>
      {label}
      {isActive ? (
        activeSortDirection === "asc" ? <ArrowUp className="ml-1 size-3.5" /> : <ArrowDown className="ml-1 size-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 size-3.5 opacity-50" />
      )}
    </Button>
  );
}

export interface LeadColumnsOptions {
  savedLeadIds: Set<string>;
  onSave: (lead: Lead) => void;
  onSaveAsContact: (lead: Lead) => void;
  /** The category actually searched for (e.g. "Architects") — shown instead of
      Google's own, often too-generic place type (e.g. "Services") when set. */
  searchedCategory?: string;
  sortBy?: LeadActiveSortBy;
  sortDirection?: "asc" | "desc";
  onSort: (key: LeadSortKey) => void;
  /** Query string carrying the current search/filter/sort context, appended to each
      lead's detail link so Previous/Next there can browse this same ordered list. */
  listParams?: string;
}

export function createLeadColumns({
  savedLeadIds,
  onSave,
  onSaveAsContact,
  searchedCategory,
  sortBy,
  sortDirection,
  onSort,
  listParams,
}: LeadColumnsOptions): ColumnDef<Lead>[] {
  return [
    {
      accessorKey: "name",
      header: "Business",
      cell: ({ row }) => (
        <Link
          href={`/leads/${row.original.id}${listParams ? `?${listParams}` : ""}`}
          className="text-text-primary font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const { city, state } = row.original;
        const label = [city, state].filter(Boolean).join(", ");
        return label || "—";
      },
    },
    {
      accessorKey: "rating",
      header: () => (
        <ServerSortableHeader label="Rating" sortKey="rating" activeSortBy={sortBy} activeSortDirection={sortDirection} onSort={onSort} />
      ),
      cell: ({ row }) =>
        row.original.rating !== null ? (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {row.original.rating.toFixed(1)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "reviewCount",
      header: () => (
        <ServerSortableHeader label="Reviews" sortKey="reviewCount" activeSortBy={sortBy} activeSortDirection={sortDirection} onSort={onSort} />
      ),
    },
    {
      id: "website",
      header: "Website",
      cell: ({ row }) => <WebsiteStatus website={row.original.website} httpsEnabled={row.original.audit?.httpsEnabled} />,
    },
    {
      id: "email",
      header: () => (
        <ServerSortableHeader label="Email" sortKey="email" activeSortBy={sortBy} activeSortDirection={sortDirection} onSort={onSort} />
      ),
      cell: ({ row }) => {
        const { enrichedEmail: email, enrichedEmailValid: valid, enrichedOwnerName: ownerName } = row.original;
        if (!email) return <span className="text-text-muted">—</span>;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <a
                href={`mailto:${email}`}
                className="text-brand-primary truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {email}
              </a>
              {valid === true && (
                <span title="Domain accepts mail">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                </span>
              )}
              {valid === false && (
                <span title="No mail server found for this domain">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                </span>
              )}
            </div>
            {ownerName && <p className="text-text-muted truncate text-xs">{ownerName}</p>}
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => searchedCategory ?? row.original.category ?? "—",
    },
    {
      id: "performance",
      header: "Performance",
      cell: ({ row }) => <ScoreGauge value={row.original.audit?.performanceScore ?? null} size={44} />,
    },
    {
      id: "seo",
      header: "SEO",
      cell: ({ row }) => <ScoreGauge value={row.original.audit?.seoScore ?? null} size={44} />,
    },
    {
      accessorKey: "opportunityScore",
      header: () => (
        <ServerSortableHeader
          label="Opportunity Score"
          sortKey="opportunityScore"
          activeSortBy={sortBy}
          activeSortDirection={sortDirection}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => <OpportunityBadge score={row.original.opportunityScore} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const isSaved = savedLeadIds.has(row.original.id);
        return (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant={isSaved ? "secondary" : "outline"} onClick={() => onSave(row.original)}>
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Save as Contact"
              aria-label="Save as Contact"
              onClick={() => onSaveAsContact(row.original)}
            >
              <BookUser className="size-3.5" />
            </Button>
            {row.original.phone && <CallButton name={row.original.name} phone={row.original.phone} />}
          </div>
        );
      },
    },
  ];
}
