"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { Invitation } from "@/types";
import toast from "react-hot-toast";

interface Props {
  refresh?: number;
  onRefresh?: () => void;
}

export function PendingInvitesList({ refresh, onRefresh }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations");
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      toast.error("Failed to load invitations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [refresh]);

  const revoke = async (id: string) => {
    if (!confirm("Revoke this invite? The link will no longer work.")) return;
    try {
      // We pass the raw token — but we only store the hashed token in DB.
      // So we revoke by ID via a different route.
      const res = await fetch(`/api/invitations/by-id/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Invite revoked.");
      fetchInvitations();
      onRefresh?.();
    } catch {
      toast.error("Failed to revoke invite.");
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (loading) {
    return <div className="text-sm text-text-muted py-4">Loading invitations...</div>;
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No pending invitations
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv) => {
        const expired = isExpired(inv.expiresAt);
        return (
          <div
            key={inv.id}
            className="flex items-center justify-between p-3 bg-surface-secondary rounded-card border border-border"
          >
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-text-primary">{inv.name}</p>
                <Badge variant={expired ? "danger" : "warning"}>
                  {expired ? "Expired" : "Pending"}
                </Badge>
                <Badge variant="muted" className="capitalize">{inv.role}</Badge>
              </div>
              <p className="text-xs text-text-secondary">{inv.email}</p>
              <p className="text-xs text-text-muted mt-0.5">
                Invited by {inv.invitedBy.name} •{" "}
                {expired
                  ? `Expired ${formatRelativeTime(inv.expiresAt)}`
                  : `Expires ${formatDate(inv.expiresAt)}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => revoke(inv.id)}
              className="text-danger hover:text-danger hover:bg-red-50 flex-shrink-0"
            >
              Revoke
            </Button>
          </div>
        );
      })}
    </div>
  );
}
