"use client";

import { useEffect, useState } from "react";
import { Grid3x3, Mic, MicOff, Phone, PhoneOff } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { useCall } from "@/lib/callStore";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  ringing: "Ringing…",
  "in-progress": "On call",
};

const KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const KEYPAD_LETTERS: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Floating in-call widget — mirrors the ChatHeadBubbles corner position/pattern, offset above it so both can coexist. */
export function CallWidget() {
  const { call, hangUp, toggleMute, sendDigits } = useCall();
  const [now, setNow] = useState(() => Date.now());
  const [showDialpad, setShowDialpad] = useState(false);
  const [pressed, setPressed] = useState("");

  useEffect(() => {
    if (!call || call.status !== "in-progress") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [call?.status]);

  // Dialpad only makes sense once actually connected, and shouldn't carry
  // over digits typed on a previous call into the next one.
  useEffect(() => {
    if (call?.status !== "in-progress") {
      setShowDialpad(false);
      setPressed("");
    }
  }, [call?.status]);

  if (!call) return null;

  const duration = call.startedAt ? now - call.startedAt : 0;

  function pressKey(key: string) {
    sendDigits(key);
    setPressed((prev) => prev + key);
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 flex w-72 flex-col items-center gap-3 rounded-card border border-border bg-white p-5 shadow-2xl">
      <Avatar name={call.target.name} size="lg" />
      <div className="text-center">
        <p className="text-text-primary text-sm font-semibold">{call.target.name}</p>
        <p className="text-text-muted text-xs">{call.target.phone}</p>
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            call.status === "in-progress" ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {call.status === "in-progress" ? formatDuration(duration) : STATUS_LABEL[call.status]}
        </p>
      </div>

      {showDialpad && call.status === "in-progress" && (
        <div className="w-full space-y-2">
          {pressed && <p className="text-text-secondary text-center text-sm tracking-widest">{pressed}</p>}
          <div className="grid grid-cols-3 gap-2">
            {KEYPAD_KEYS.flat().map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className="text-text-primary hover:bg-surface-hover active:bg-surface-secondary flex flex-col items-center justify-center gap-0.5 rounded-btn border border-border py-1.5 transition-colors"
              >
                <span className="text-sm font-medium leading-none">{key}</span>
                <span className="text-text-muted text-[9px] font-medium leading-none tracking-wide">
                  {KEYPAD_LETTERS[key] ?? " "}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMute}
          disabled={call.status !== "in-progress"}
          title={call.isMuted ? "Unmute" : "Mute"}
          className="flex size-11 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {call.isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setShowDialpad((prev) => !prev)}
          disabled={call.status !== "in-progress"}
          title="Keypad"
          className={cn(
            "flex size-11 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            showDialpad
              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
              : "border-border text-text-secondary hover:bg-surface-secondary",
          )}
        >
          <Grid3x3 className="size-4" />
        </button>
        <button
          type="button"
          onClick={hangUp}
          title="Hang up"
          className="bg-danger flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-red-600"
        >
          <PhoneOff className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Small reusable "Call" trigger — used on contact records. Disabled with an explanatory title when the contact has no phone number. */
export function CallButton({ contactId, name, phone }: { contactId?: string; name: string; phone: string | null | undefined }) {
  const { startCall } = useCall();

  return (
    <button
      type="button"
      disabled={!phone}
      title={phone ? `Call ${phone}` : "No phone number on file"}
      onClick={() => phone && startCall({ contactId, name, phone })}
      className="text-text-muted hover:text-brand-primary disabled:hover:text-text-muted inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Phone className="size-3.5" />
    </button>
  );
}
