import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { getTwilioCredentials } from "@/lib/twilio";

/**
 * TwiML Twilio fetches for the called party's own leg before bridging it
 * into the call (via <Number url="...">) — plays the recording disclosure
 * to them specifically, not the agent. Once this document finishes with no
 * further verb, Twilio proceeds to bridge the leg into the parent <Dial> as
 * normal. Signature-verified like the other Twilio-only webhooks.
 */
export async function POST(req: NextRequest) {
  const creds = await getTwilioCredentials();
  if (!creds) return new NextResponse("Twilio is not configured.", { status: 503 });

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const signature = req.headers.get("X-Twilio-Signature") ?? "";

  if (!twilio.validateRequest(creds.authToken, signature, req.url, params)) {
    return new NextResponse("Invalid signature.", { status: 403 });
  }

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say("This call may be recorded for quality and training purposes.");

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
