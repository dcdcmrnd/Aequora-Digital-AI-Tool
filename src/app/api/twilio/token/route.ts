import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import twilio from "twilio";

import { authOptions } from "@/lib/auth";
import { getTwilioCredentials } from "@/lib/twilio";

/** Issues a short-lived Voice access token for the current user's browser Device (Twilio Voice SDK). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await getTwilioCredentials();
  if (!creds?.apiKeySid || !creds.apiKeySecret || !creds.twimlAppSid) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(creds.accountSid, creds.apiKeySid, creds.apiKeySecret, {
    identity: session.user.id,
    ttl: 3600,
  });
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: creds.twimlAppSid }));

  return NextResponse.json({ token: token.toJwt() });
}
