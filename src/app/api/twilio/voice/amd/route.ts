import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { prisma } from "@/lib/prisma";
import { getTwilioCredentials } from "@/lib/twilio";

/**
 * Answering Machine Detection result callback for the dialed leg — Twilio
 * reports whether a human or voicemail greeting answered. Signature-verified,
 * same reasoning as /api/twilio/voice. Reads callId from the query string
 * (not params.CallSid) because Twilio's docs identify the CallSid in this
 * callback as the child leg, unlike the parent-leg convention used by the
 * recording callback — embedding our own id sidesteps that ambiguity.
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

  const callId = req.nextUrl.searchParams.get("callId");
  if (!callId || !params.AnsweredBy) return new NextResponse(null, { status: 204 });

  await prisma.call.updateMany({
    where: { id: callId },
    data: { answeredBy: params.AnsweredBy },
  });

  return new NextResponse(null, { status: 204 });
}
