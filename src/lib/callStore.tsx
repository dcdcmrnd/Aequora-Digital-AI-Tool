"use client";

import { Call as TwilioCall, Device } from "@twilio/voice-sdk";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";

export interface CallTarget {
  contactId?: string;
  name: string;
  phone: string;
}

type CallStatus = "connecting" | "ringing" | "in-progress";

interface CallState {
  target: CallTarget;
  status: CallStatus;
  isMuted: boolean;
  startedAt: number | null;
}

interface CallContextValue {
  call: CallState | null;
  startCall: (target: CallTarget) => void;
  hangUp: () => void;
  toggleMute: () => void;
  sendDigits: (digits: string) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const deviceRef = useRef<Device | null>(null);
  const connectionRef = useRef<TwilioCall | null>(null);
  const [call, setCall] = useState<CallState | null>(null);

  const ensureDevice = useCallback(async (): Promise<Device> => {
    if (deviceRef.current) return deviceRef.current;
    const { token } = await apiFetch<{ token: string }>("/api/twilio/token");
    const device = new Device(token, { logLevel: "error" });
    await device.register();
    deviceRef.current = device;
    return device;
  }, []);

  const startCall = useCallback(
    async (target: CallTarget) => {
      if (connectionRef.current) {
        toast.error("You're already on a call.");
        return;
      }

      setCall({ target, status: "connecting", isMuted: false, startedAt: null });

      try {
        const { callId, toNumber } = await apiFetch<{ callId: string; toNumber: string; fromNumber: string }>(
          "/api/calls",
          { method: "POST", body: JSON.stringify({ contactId: target.contactId, toNumber: target.phone }) },
        );

        const device = await ensureDevice();
        const connection = await device.connect({ params: { To: toNumber, callId } });
        connectionRef.current = connection;

        connection.on("ringing", () => setCall((prev) => (prev ? { ...prev, status: "ringing" } : prev)));
        connection.on("accept", () =>
          setCall((prev) => (prev ? { ...prev, status: "in-progress", startedAt: Date.now() } : prev)),
        );
        const clearCall = () => {
          setCall(null);
          connectionRef.current = null;
        };
        connection.on("disconnect", clearCall);
        connection.on("cancel", clearCall);
        connection.on("error", (err: Error) => {
          toast.error(err?.message || "Call failed.");
          clearCall();
        });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Couldn't start the call.");
        setCall(null);
      }
    },
    [ensureDevice],
  );

  const hangUp = useCallback(() => {
    connectionRef.current?.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    setCall((prev) => {
      if (!prev || !connectionRef.current) return prev;
      const next = !prev.isMuted;
      connectionRef.current.mute(next);
      return { ...prev, isMuted: next };
    });
  }, []);

  /** Sends DTMF tones on the live call (e.g. punching an extension into an IVR menu) -- a no-op if nothing's connected yet. */
  const sendDigits = useCallback((digits: string) => {
    connectionRef.current?.sendDigits(digits);
  }, []);

  return (
    <CallContext.Provider value={{ call, startCall, hangUp, toggleMute, sendDigits }}>{children}</CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
