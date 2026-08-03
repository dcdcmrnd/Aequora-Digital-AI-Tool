"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface PaginationBarProps {
  page: number;
  pageCount: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

export function PaginationBar({ page, pageCount, total, itemLabel, onPageChange }: PaginationBarProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-text-muted text-sm">
        Page {page} of {pageCount} · {total} {itemLabel}
        {total === 1 ? "" : "s"}
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
  );
}
