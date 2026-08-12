"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { createPeopleColumns } from "@/components/leads/peopleColumns";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { LeadPerson } from "@/types";

interface PeopleTableProps {
  data: LeadPerson[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (idsOnPage: string[]) => void;
  onSaveAsContact: (person: LeadPerson) => void;
  savingId?: string;
}

export function PeopleTable({
  data,
  page,
  pageSize,
  total,
  onPageChange,
  selectedIds,
  onToggle,
  onToggleAll,
  onSaveAsContact,
  savingId,
}: PeopleTableProps) {
  const allSelected = data.length > 0 && data.every((person) => selectedIds.has(person.id));

  const columns = useMemo(
    () =>
      createPeopleColumns({
        selectedIds,
        allSelected,
        onToggle,
        onToggleAll: () => onToggleAll(data.map((person) => person.id)),
        onSaveAsContact,
        savingId,
      }),
    [selectedIds, allSelected, onToggle, onToggleAll, data, onSaveAsContact, savingId],
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="rounded-card border-border overflow-x-auto border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
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
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-text-muted h-24 text-center">
                  No people found yet — try &quot;Find People&quot; on a business in the Company tab.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-text-muted text-sm">
          Page {page} of {pageCount} · {total} people
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
    </div>
  );
}
