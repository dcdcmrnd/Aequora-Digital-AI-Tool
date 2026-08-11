import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { prisma } from "@/lib/prisma";
import { getTwilioCredentials } from "@/lib/twilio";

/**
 * Twilio-only recordingStatusCallback for the <Dial record="..."> on
 * /api/twilio/voice — fires once the recording has finished processing.
 * CallSid here is the parent (agent) leg's SID, the same one already stored
 * as Call.twilioCallSid when the call started. Signature-verified, same
 * reasoning as the other Twilio webhooks.
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

  if (params.RecordingStatus === "completed" && params.CallSid && params.RecordingSid) {
    await prisma.call.updateMany({
      where: { twilioCallSid: params.CallSid },
      data: {
        recordingSid: params.RecordingSid,
        recordingUrl: params.RecordingUrl || undefined,
        recordingDurationSec: params.RecordingDuration ? Number(params.RecordingDuration) : undefined,
      },
    });
  }

  return new NextResponse(null, { status: 204 });
}
