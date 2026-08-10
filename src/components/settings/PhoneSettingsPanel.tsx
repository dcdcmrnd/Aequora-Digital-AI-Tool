"use client";

import { useEffect, useState } from "react";
import { Phone, Search } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
}

export function PhoneSettingsPanel() {
  const [currentNumber, setCurrentNumber] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/twilio/numbers");
      const data = await res.json();
      setCurrentNumber(data.phoneNumber ?? null);
      setConfigured(data.twilioConfigured ?? false);
    } catch {
      toast.error("Couldn't load calling settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSearch() {
    setSearching(true);
    setResults(null);
    try {
      const params = new URLSearchParams();
      if (areaCode.trim()) params.set("areaCode", areaCode.trim());
      const res = await fetch(`/api/twilio/numbers/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.numbers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't search for numbers.");
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    if (
      !confirm(
        `Buy ${phoneNumber} as your agency's calling number? This adds a recurring monthly charge to your Twilio account, plus per-minute call rates.`,
      )
    ) {
      return;
    }
    setPurchasing(phoneNumber);
    try {
      const res = await fetch("/api/twilio/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed.");
      toast.success(`${phoneNumber} is now your calling number`);
      setResults(null);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't purchase this number.");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRelease() {
    if (
      !confirm(
        "Release this number? Calling will stop working immediately, and this can't be undone — you'd need to buy a new one (possibly a different number).",
      )
    ) {
      return;
    }
    setReleasing(true);
    try {
      const res = await fetch("/api/twilio/numbers", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release.");
      toast.success("Number released");
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't release this number.");
    } finally {
      setReleasing(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/twilio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountSid: accountSid.trim(), authToken: authToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't connect Twilio.");
      toast.success("Twilio connected");
      setAccountSid("");
      setAuthToken("");
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't connect Twilio.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Twilio? Calling will stop working until you reconnect.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/twilio/connect", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't disconnect Twilio.");
      toast.success("Twilio disconnected");
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect Twilio.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-white p-5 max-w-lg">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Phone className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">Calling</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            Purchase a US phone number to enable click-to-call from any contact. Outbound calling only for
            now — no SMS or inbound calls yet. Each number carries a recurring monthly charge from Twilio,
            plus per-minute call rates.
          </p>

          {loading ? (
            <p className="text-text-muted mt-4 text-sm">Loading...</p>
          ) : !configured ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-input border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Twilio isn&apos;t connected yet. Log in to your{" "}
                <a
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  Twilio Console
                </a>{" "}
                and paste your Account SID and Auth Token below — both are shown right on the console home
                page. We&apos;ll automatically set up everything else needed for calling.
              </div>
              <Input
                placeholder="Account SID (starts with AC...)"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
              />
              <Input
                placeholder="Auth Token"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleConnect}
                loading={connecting}
                disabled={!accountSid.trim() || !authToken.trim()}
              >
                Connect Twilio
              </Button>
            </div>
          ) : currentNumber ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-input border border-border bg-surface-secondary px-3 py-2">
                <span className="text-text-primary text-sm">{currentNumber}</span>
                <Button variant="secondary" size="sm" onClick={handleRelease} loading={releasing}>
                  Release
                </Button>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-text-muted hover:text-danger text-xs disabled:opacity-40"
              >
                Disconnect Twilio
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Area code (optional), e.g. 415"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  className="max-w-[220px]"
                />
                <Button variant="secondary" size="sm" onClick={handleSearch} loading={searching}>
                  <Search className="size-4" />
                  Search
                </Button>
              </div>

              {results &&
                (results.length === 0 ? (
                  <p className="text-text-muted text-sm">No numbers found. Try a different area code.</p>
                ) : (
                  <div className="space-y-2">
                    {results.map((n) => (
                      <div
                        key={n.phoneNumber}
                        className="rounded-input border-border flex items-center justify-between gap-3 border px-3 py-2"
                      >
                        <div>
                          <p className="text-text-primary text-sm">{n.phoneNumber}</p>
                          <p className="text-text-muted text-xs">
                            {[n.locality, n.region].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handlePurchase(n.phoneNumber)} loading={purchasing === n.phoneNumber}>
                          Buy
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
