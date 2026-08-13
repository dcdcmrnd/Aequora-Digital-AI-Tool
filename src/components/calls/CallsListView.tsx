"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, PhoneCall } from "lucide-react";

import { ContactQuickView } from "@/components/inbox/ContactQuickView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCalls } from "@/hooks/useCalls";
import { CALL_STATUS_LABEL, formatCallDuration, isVoicemail } from "@/lib/calls";
import { formatRelativeTime } from "@/lib/utils";

export function CallsListView() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCalls(page);
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="text-text-muted text-sm">Recordings from every call, most recent first.</p>
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
          <div className="space-y-2">
            {data.calls.map((call) => (
              <div key={call.id} className="rounded-card border-border border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {call.contact ? (
                      <button
                        onClick={() => setViewingContactId(call.contact!.id)}
                        className="text-text-primary text-sm font-medium hover:underline"
                      >
                        {call.contact.name}
                      </button>
                    ) : (
                      <p className="text-text-primary text-sm font-medium">{call.toNumber}</p>
                    )}
                    <p className="text-text-muted text-xs">
                      {call.user.name} · {formatRelativeTime(call.createdAt)}
                      {call.durationSec !== null && ` · ${formatCallDuration(call.durationSec)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isVoicemail(call.answeredBy) && <Badge variant="warning">Voicemail</Badge>}
                    <span className="text-text-muted text-xs">{CALL_STATUS_LABEL[call.status] ?? call.status}</span>
                  </div>
                </div>

                {call.recordingSid ? (
                  <audio controls preload="none" className="mt-3 h-9 w-full" src={`/api/calls/${call.id}/recording`} />
                ) : (
                  <p className="text-text-muted mt-2 text-xs">No recording for this call.</p>
                )}
              </div>
            ))}
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
