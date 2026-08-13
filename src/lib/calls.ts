export const CALL_STATUS_LABEL: Record<string, string> = {
  "queued": "Queued",
  "ringing": "Ringing",
  "in-progress": "In progress",
  "completed": "Completed",
  "failed": "Failed",
  "busy": "Busy",
  "no-answer": "No answer",
  "canceled": "Canceled",
};

export function formatCallDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** True when Twilio's Answering Machine Detection reported a voicemail greeting (any machine_* value) rather than a human pickup. */
export function isVoicemail(answeredBy: string | null | undefined): boolean {
  return !!answeredBy?.startsWith("machine_");
}
