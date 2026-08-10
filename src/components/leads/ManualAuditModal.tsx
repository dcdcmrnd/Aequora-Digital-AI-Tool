"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useManualLeadAudit } from "@/hooks/useManualLeadAudit";
import { ApiError } from "@/lib/api-client";

interface ManualAuditModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManualAuditModal({ open, onClose }: ManualAuditModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const auditLead = useManualLeadAudit();

  function handleClose() {
    setName("");
    setWebsite("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !website.trim()) return;

    auditLead.mutate(
      { name: name.trim() || undefined, website: website.trim() || undefined },
      {
        onSuccess: ({ lead }) => {
          toast.success(`Audited ${lead.name}`);
          handleClose();
          router.push(`/leads/${lead.id}`);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't audit this business."),
      },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Audit a Specific Business">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <p className="text-text-secondary text-sm">
          Already know the business? Enter its name and/or website to run the same performance, SEO, and
          opportunity scoring used for search results — no need to search by category and location first.
        </p>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Business Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Plumbing" />
        </label>
        <label className="block space-y-1">
          <span className="text-text-secondary text-xs font-medium">Website</span>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="e.g. acmeplumbing.com" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={auditLead.isPending} disabled={!name.trim() && !website.trim()}>
            Run Audit
          </Button>
        </div>
      </form>
    </Modal>
  );
}
