import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwilioCredentials } from "@/lib/twilio";

/**
 * Streams a call recording's audio through our own server so the browser
 * never needs Twilio credentials — Twilio's recording URLs require Basic
 * Auth with the account's Account SID/Auth Token to fetch.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const call = await prisma.call.findUnique({ where: { id: params.id }, select: { recordingSid: true } });
  if (!call?.recordingSid) return NextResponse.json({ error: "No recording for this call." }, { status: 404 });

  const creds = await getTwilioCredentials();
  if (!creds) return NextResponse.json({ error: "Twilio is not configured." }, { status: 503 });

  const recordingRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Recordings/${call.recordingSid}.mp3`,
    { headers: { Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}` } },
  );

  if (!recordingRes.ok || !recordingRes.body) {
    return NextResponse.json({ error: "Couldn't fetch the recording." }, { status: 502 });
  }

  return new NextResponse(recordingRes.body, { headers: { "Content-Type": "audio/mpeg" } });
}
