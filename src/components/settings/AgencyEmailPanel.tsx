"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Plus, Star } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface AgencyEmailPanelProps {
  emails: { email: string; isPrimary: boolean }[];
}

export function AgencyEmailPanel({ emails }: AgencyEmailPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("connected") === "agency") {
      toast.success("Gmail connected");
      router.replace("/settings");
    } else if (searchParams.get("error")) {
      toast.error("Failed to connect Gmail. Please try again.");
      router.replace("/settings");
    }
  }, [searchParams, router]);

  async function handleDisconnect(email: string) {
    if (!confirm(`Disconnect ${email}? Automations or inbox activity using this address will stop working until you reconnect.`)) return;
    setDisconnecting(email);
    try {
      const res = await fetch(`/api/gmail/disconnect?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Gmail disconnected");
      router.refresh();
    } catch {
      toast.error("Failed to disconnect Gmail");
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleSetPrimary(email: string) {
    setSettingPrimary(email);
    try {
      const res = await fetch("/api/gmail/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${email} is now the default in Conversations`);
      router.refresh();
    } catch {
      toast.error("Failed to set default email");
    } finally {
      setSettingPrimary(null);
    }
  }

  return (
    <div className="rounded-card border border-border bg-white p-5 max-w-lg">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Mail className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">Agency Email</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            Connect the Gmail accounts your agency sends from. Used by Conversations, Contact
            messaging, and Automation email actions. For your own personal inbox, connect it
            under Profile → My Email instead. When more than one is connected, mark one as
            Default so Conversations opens there — the rest stay available to switch to.
          </p>

          <div className="mt-4 space-y-2">
            {emails.length === 0 && (
              <div className="flex items-center justify-between gap-3 rounded-input border border-border bg-surface-secondary px-3 py-2">
                <span className="text-sm text-text-muted">Not connected</span>
              </div>
            )}
            {emails.map(({ email, isPrimary }) => (
              <div
                key={email}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-input border px-3 py-2",
                  isPrimary ? "border-brand-primary bg-brand-primary/5" : "border-border bg-surface-secondary",
                )}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {isPrimary && <Star className="size-3.5 shrink-0 fill-brand-primary text-brand-primary" />}
                  <span className="text-sm text-text-primary truncate">{email}</span>
                  {isPrimary && <span className="text-brand-primary shrink-0 text-xs font-medium">Default</span>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!isPrimary && emails.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimary(email)}
                      loading={settingPrimary === email}
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDisconnect(email)}
                    loading={disconnecting === email}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}

            <a href="/api/gmail/auth?scope=agency" className="block">
              <Button variant="secondary" size="sm" className="w-full">
                <Plus className="size-4" />
                {emails.length === 0 ? "Connect Gmail" : "Connect Another Account"}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
