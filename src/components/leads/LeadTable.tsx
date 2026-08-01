"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { createLeadColumns } from "@/components/leads/columns";
import { ContactFormModal } from "@/components/contacts/ContactFormModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { Lead } from "@/types";

interface LeadTableProps {
  data: Lead[];
  savedLeadIds: Set<string>;
  onSave: (lead: Lead) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function LeadTable({ data, savedLeadIds, onSave, page, pageSize, total, onPageChange }: LeadTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [contactPrefillLead, setContactPrefillLead] = useState<Lead | null>(null);

  const columns = useMemo(
    () => createLeadColumns({ savedLeadIds, onSave, onSaveAsContact: setContactPrefillLead }),
    [savedLeadIds, onSave],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.name.toLowerCase().includes(String(filterValue).toLowerCase()),
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search this page..."
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        className="max-w-xs"
      />

      <div className="rounded-card border-border overflow-x-auto border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-text-muted h-24 text-center">
                  No leads found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-text-muted text-sm">
          Page {page} of {pageCount} · {total} leads
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="size-3.5" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
            Next <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {contactPrefillLead && (
        <ContactFormModal
          open={!!contactPrefillLead}
          onClose={() => setContactPrefillLead(null)}
          prefill={{
            name: contactPrefillLead.name,
            phone: contactPrefillLead.phone ?? undefined,
            website: contactPrefillLead.website ?? undefined,
            address: contactPrefillLead.address ?? undefined,
            sourceLeadId: contactPrefillLead.id,
          }}
        />
      )}
    </div>
  );
}
