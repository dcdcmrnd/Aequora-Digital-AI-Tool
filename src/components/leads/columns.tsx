"use client";

import Link from "next/link";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, BookUser, Star } from "lucide-react";

import { OpportunityBadge } from "@/components/leads/OpportunityBadge";
import { ScoreGauge } from "@/components/leads/ScoreGauge";
import { WebsiteStatus } from "@/components/leads/WebsiteStatus";
import { Button } from "@/components/ui/Button";
import type { Lead } from "@/types";

function SortableHeader({ column, label }: { column: Column<Lead, unknown>; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-1 size-3.5" />
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
}

export function createLeadColumns({ savedLeadIds, onSave, onSaveAsContact, searchedCategory }: LeadColumnsOptions): ColumnDef<Lead>[] {
  return [
    {
      accessorKey: "name",
      header: "Business",
      cell: ({ row }) => (
        <Link href={`/leads/${row.original.id}`} className="text-text-primary font-medium hover:underline">
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
      header: ({ column }) => <SortableHeader column={column} label="Rating" />,
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
      header: ({ column }) => <SortableHeader column={column} label="Reviews" />,
    },
    {
      id: "website",
      header: "Website",
      cell: ({ row }) => <WebsiteStatus website={row.original.website} httpsEnabled={row.original.audit?.httpsEnabled} />,
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.original.enrichedEmail;
        return email ? (
          <a href={`mailto:${email}`} className="text-brand-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {email}
          </a>
        ) : (
          <span className="text-text-muted">—</span>
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
      header: ({ column }) => <SortableHeader column={column} label="Opportunity Score" />,
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
          </div>
        );
      },
    },
  ];
}
