import twilio from "twilio";

/** Whether the base Twilio account credentials are configured at all. */
export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/** Whether everything needed to issue browser Voice access tokens is configured. */
export function isVoiceConfigured(): boolean {
  return (
    isTwilioConfigured() &&
    !!process.env.TWILIO_API_KEY_SID &&
    !!process.env.TWILIO_API_KEY_SECRET &&
    !!process.env.TWILIO_TWIML_APP_SID
  );
}

export function createTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error("Twilio is not configured");
  return twilio(accountSid, authToken);
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
