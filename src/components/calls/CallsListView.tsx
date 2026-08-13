"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, PhoneCall } from "lucide-react";

import { ContactQuickView } from "@/components/inbox/ContactQuickView";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useCalls } from "@/hooks/useCalls";
import { CALL_STATUS_LABEL, formatCallDuration } from "@/lib/calls";
import { formatRelativeTime } from "@/lib/utils";

export function CallsListView() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCalls(page);
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="text-text-muted text-sm">Every outbound call across all contacts, most recent first.</p>
      </div>

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : !data || data.calls.length === 0 ? (
        <p className="text-text-muted text-sm">
          <PhoneCall className="mr-1.5 inline size-4" />
          No calls yet.
        </p>
      ) : (
        <>
          <div className="rounded-card border-border overflow-x-auto border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Recording</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      {call.contact ? (
                        <button
                          onClick={() => setViewingContactId(call.contact!.id)}
                          className="text-brand-primary text-left font-medium hover:underline"
                        >
                          {call.contact.name}
                        </button>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{call.toNumber}</TableCell>
                    <TableCell>{CALL_STATUS_LABEL[call.status] ?? call.status}</TableCell>
                    <TableCell>{formatCallDuration(call.durationSec) || "—"}</TableCell>
                    <TableCell>{call.user.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatRelativeTime(call.createdAt)}</TableCell>
                    <TableCell>
                      {call.recordingSid ? (
                        <audio controls preload="none" className="h-8 w-56" src={`/api/calls/${call.id}/recording`} />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-text-muted text-sm">
              Page {page} of {pageCount} · {data.total} call{data.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="size-3.5" /> Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount}>
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {viewingContactId && <ContactQuickView contactId={viewingContactId} onClose={() => setViewingContactId(null)} />}
    </div>
  );
}
