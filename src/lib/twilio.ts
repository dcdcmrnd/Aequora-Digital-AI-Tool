import twilio from "twilio";

import { prisma } from "@/lib/prisma";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  apiKeySid: string | null;
  apiKeySecret: string | null;
  twimlAppSid: string | null;
}

/** Reads the agency's Twilio connection from the DB (set once via Settings → Calling). */
export async function getTwilioCredentials(): Promise<TwilioCredentials | null> {
  const settings = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.accountSid || !settings.authToken) return null;
  return {
    accountSid: settings.accountSid,
    authToken: settings.authToken,
    apiKeySid: settings.apiKeySid,
    apiKeySecret: settings.apiKeySecret,
    twimlAppSid: settings.twimlAppSid,
  };
}

/** Whether the base Twilio account is connected at all. */
export async function isTwilioConfigured(): Promise<boolean> {
  return (await getTwilioCredentials()) !== null;
}

/** Whether everything needed to issue browser Voice access tokens is set up. */
export async function isVoiceConfigured(): Promise<boolean> {
  const creds = await getTwilioCredentials();
  return !!(creds?.apiKeySid && creds.apiKeySecret && creds.twimlAppSid);
}

export async function createTwilioClient() {
  const creds = await getTwilioCredentials();
  if (!creds) throw new Error("Twilio is not connected");
  return twilio(creds.accountSid, creds.authToken);
}

/** E.164: optional leading +, 1-15 digits, first digit 1-9. */
export function isE164(value: string): boolean {
  return /^\+?[1-9]\d{1,14}$/.test(value);
}

/**
 * Contact phone numbers in this CRM are free text ("(555) 123-4567", "555.123.4567",
 * etc.), not E.164 — this turns typical US formatting into E.164 so calling works
 * without asking anyone to re-type numbers. Returns null if it can't confidently do
 * that (e.g. already-international numbers not starting with +, or too few digits).
 */
export function normalizeUsPhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return isE164(trimmed) ? trimmed : null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
