"use client";

import { useState } from "react";
import { Building2, Search, ShieldCheck, ShieldQuestion, ShieldX, User } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useIdentifyEmail } from "@/hooks/useIdentifyEmail";
import type { EmailVerificationStatus } from "@/lib/emailVerification";

const VERIFICATION_DISPLAY: Record<EmailVerificationStatus, { label: string; variant: "success" | "danger" | "muted"; icon: typeof ShieldCheck }> = {
  valid: { label: "Domain accepts mail", variant: "success", icon: ShieldCheck },
  invalid: { label: "Invalid address or domain", variant: "danger", icon: ShieldX },
  unknown: { label: "Could not determine", variant: "muted", icon: ShieldQuestion },
};

const CONFIDENCE_VARIANT = { high: "success", medium: "warning", low: "muted" } as const;

/**
 * Given a bare email address: checks domain-level deliverability (same MX
 * check the rest of the app uses -- no paid API, and no claim that a specific
 * mailbox is confirmed live), then best-effort identifies the company behind
 * the domain and, if a match is found on that company's own site, the
 * person's name and title.
 */
export function IdentifyEmailView() {
  const [email, setEmail] = useState("");
  const lookup = useIdentifyEmail();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    lookup.mutate(email.trim());
  }

  const result = lookup.data;
  const verification = result ? VERIFICATION_DISPLAY[result.verification] : null;
  const VerificationIcon = verification?.icon;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-text-secondary mb-1 block text-xs font-medium">Email address</label>
          <Input
            type="email"
            placeholder="e.g. jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-72"
          />
        </div>
        <Button type="submit" loading={lookup.isPending} disabled={!email.trim()}>
          <Search className="size-3.5" />
          Identify
        </Button>
      </form>

      {lookup.isPending && (
        <p className="text-text-muted text-sm">
          Checking the domain and crawling the company&apos;s site for a matching person — this can take up to 30
          seconds.
        </p>
      )}

      {result && (
        <div className="border-border divide-border rounded-card divide-y border">
          <div className="flex items-center gap-3 p-4">
            {VerificationIcon && <VerificationIcon className="text-text-muted size-4 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-text-primary truncate text-sm font-medium">{result.email}</p>
              <p className="text-text-muted text-xs">{result.domain}</p>
            </div>
            {verification && <Badge variant={verification.variant}>{verification.label}</Badge>}
          </div>

          <div className="flex items-center gap-3 p-4">
            <Building2 className="text-text-muted size-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-text-secondary mb-0.5 text-xs font-medium">Company</p>
              {result.company?.name ? (
                <p className="text-text-primary text-sm">{result.company.name}</p>
              ) : result.company ? (
                <p className="text-text-muted text-sm">Site reached, but no company name could be determined.</p>
              ) : (
                <p className="text-text-muted text-sm">
                  {result.verification === "invalid"
                    ? "Not checked — the address or domain is invalid."
                    : "Could not reach a website for this domain."}
                </p>
              )}
              {result.company?.url && (
                <a href={result.company.url} target="_blank" rel="noreferrer" className="text-brand-primary text-xs hover:underline">
                  {result.company.url}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-4">
            <User className="text-text-muted mt-0.5 size-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-text-secondary mb-0.5 text-xs font-medium">Owner / position</p>
              {result.person ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-text-primary text-sm font-medium">{result.person.name}</p>
                    <Badge variant={CONFIDENCE_VARIANT[result.person.confidence]}>{result.person.confidence} confidence</Badge>
                  </div>
                  <p className="text-text-muted text-xs">{result.person.title ?? "No title found"}</p>
                  <p className="text-text-muted mt-1 text-xs">
                    {result.person.emailSource === "scraped"
                      ? "Email found directly on the company's site."
                      : "Email inferred from the company's naming pattern."}
                  </p>
                </>
              ) : (
                <p className="text-text-muted text-sm">
                  {result.company
                    ? "No person on the company's site matched this exact address."
                    : "Not checked — no company site was reached."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!result && !lookup.isPending && (
        <p className="text-text-muted text-xs">
          Checks the domain for mail-server records, then crawls the company&apos;s own website (About/Team/Contact
          pages) for a person whose email matches exactly — never a guessed identity. &quot;Verified&quot; means the
          domain can receive mail, not that this specific mailbox is confirmed live (mailbox-level probing doesn&apos;t
          work reliably from serverless hosting).
        </p>
      )}
    </div>
  );
}
