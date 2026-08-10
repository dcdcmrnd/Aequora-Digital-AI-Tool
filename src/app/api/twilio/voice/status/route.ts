import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { prisma } from "@/lib/prisma";

/** Twilio-only status callback for the dialed leg of a click-to-call — updates the Call record's status/duration as it progresses. Signature-verified, same reasoning as /api/twilio/voice. */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return new NextResponse("Twilio is not configured.", { status: 503 });

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const signature = req.headers.get("X-Twilio-Signature") ?? "";

  if (!twilio.validateRequest(authToken, signature, req.url, params)) {
    return new NextResponse("Invalid signature.", { status: 403 });
  }

  const callId = req.nextUrl.searchParams.get("callId");
  if (!callId) return new NextResponse(null, { status: 204 });

  const status = params.CallStatus;
  const durationRaw = params.CallDuration;

  await prisma.call.updateMany({
    where: { id: callId },
    data: {
      ...(status ? { status } : {}),
      ...(durationRaw ? { durationSec: Number(durationRaw) } : {}),
      ...(params.CallSid ? { twilioCallSid: params.CallSid } : {}),
    },
  });

  return new NextResponse(null, { status: 204 });
}
