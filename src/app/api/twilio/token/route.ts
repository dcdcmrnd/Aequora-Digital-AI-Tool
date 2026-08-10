import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import twilio from "twilio";

import { authOptions } from "@/lib/auth";
import { isVoiceConfigured } from "@/lib/twilio";

/** Issues a short-lived Voice access token for the current user's browser Device (Twilio Voice SDK). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isVoiceConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY_SID!,
    process.env.TWILIO_API_KEY_SECRET!,
    { identity: session.user.id, ttl: 3600 },
  );
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID! }));

  return NextResponse.json({ token: token.toJwt() });
}
