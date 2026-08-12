"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, BookUser, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { LeadPerson } from "@/types";

const CHECKBOX_CLASS = "text-brand-primary focus:ring-brand-primary size-4 rounded border-border";

const SOURCE_LABELS: Record<string, string> = {
  website_crawl: "Website",
  pattern_inference: "Pattern guess",
  registry_gb: "UK registry",
  registry_us: "US registry",
  registry_au: "AU registry",
};

const CONFIDENCE_VARIANT: Record<string, "success" | "warning" | "muted"> = {
  high: "success",
  medium: "warning",
  low: "muted",
};

export interface PeopleColumnsOptions {
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSaveAsContact: (person: LeadPerson) => void;
  savingId?: string;
}

export function createPeopleColumns({
  selectedIds,
  allSelected,
  onToggle,
  onToggleAll,
  onSaveAsContact,
  savingId,
}: PeopleColumnsOptions): ColumnDef<LeadPerson>[] {
  return [
    {
      id: "select",
      header: () => (
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} className={CHECKBOX_CLASS} aria-label="Select all people on this page" />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={() => onToggle(row.original.id)}
          className={CHECKBOX_CLASS}
          aria-label={`Select ${row.original.name ?? "person"}`}
        />
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => row.original.name ?? <span className="text-text-muted">—</span>,
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const { title, matchesIcpTitle } = row.original;
        if (!title) return <span className="text-text-muted">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <span>{title}</span>
            {matchesIcpTitle && (
              <Badge variant="success" title="Matches your target title list">
                ICP
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "company",
      header: "Company",
      cell: ({ row }) =>
        row.original.lead ? (
          <Link href={`/leads/${row.original.lead.id}`} className="text-text-primary font-medium hover:underline">
            {row.original.lead.name}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const { email, emailValid, emailSource, confidence } = row.original;
        if (!email) return <span className="text-text-muted">—</span>;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <a href={`mailto:${email}`} className="text-brand-primary truncate hover:underline" onClick={(e) => e.stopPropagation()}>
                {email}
              </a>
              {emailValid === true && (
                <span title="Domain accepts mail">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                </span>
              )}
              {emailValid === false && (
                <span title="No mail server found for this domain">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                </span>
              )}
            </div>
            <p className="text-text-muted text-xs">
              {emailSource === "pattern_guess" ? "Guessed" : "Found on site"}
              {" · "}
              <Badge variant={CONFIDENCE_VARIANT[confidence] ?? "muted"} className="ml-0.5">
                {confidence}
              </Badge>
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone ?? <span className="text-text-muted">—</span>,
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => SOURCE_LABELS[row.original.source] ?? row.original.source,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          title="Save as Contact"
          aria-label="Save as Contact"
          disabled={savingId === row.original.id}
          onClick={() => onSaveAsContact(row.original)}
        >
          <BookUser className="size-3.5" />
        </Button>
      ),
    },
  ];
}
