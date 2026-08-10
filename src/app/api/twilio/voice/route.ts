import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { prisma } from "@/lib/prisma";
import { getTwilioCredentials, isE164 } from "@/lib/twilio";

/**
 * TwiML webhook Twilio calls when the browser Device (Twilio Voice SDK)
 * places an outbound call — bridges it to the real phone number. Called by
 * Twilio's servers directly, never by our own frontend, so it's verified via
 * the X-Twilio-Signature header (Twilio's Auth Token as the shared secret)
 * instead of a session — otherwise anyone could hit this URL and place calls
 * on the agency's dime.
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

  const to = params.To;
  const callId = params.callId;
  const twiml = new twilio.twiml.VoiceResponse();

  const call = callId ? await prisma.call.findUnique({ where: { id: callId } }) : null;

  if (!to || !isE164(to) || !call) {
    twiml.say("This call could not be connected.");
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  await prisma.call.update({
    where: { id: call.id },
    data: { status: "ringing", twilioCallSid: params.CallSid || undefined },
  });

  const statusCallbackUrl = new URL("/api/twilio/voice/status", req.url);
  statusCallbackUrl.searchParams.set("callId", call.id);

  const dial = twiml.dial({ callerId: call.fromNumber });
  dial.number(
    {
      statusCallback: statusCallbackUrl.toString(),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    },
    to,
  );

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
