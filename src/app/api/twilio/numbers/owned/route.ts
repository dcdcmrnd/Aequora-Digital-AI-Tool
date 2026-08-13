import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createTwilioClient, isTwilioConfigured } from "@/lib/twilio";

/** Admin-only: lists numbers already owned on the connected Twilio account — e.g. purchased directly in the Twilio Console instead of through this app. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await isTwilioConfigured())) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const client = await createTwilioClient();
    const owned = await client.incomingPhoneNumbers.list({ limit: 20 });

    return NextResponse.json({
      numbers: owned.map((n) => ({ sid: n.sid, phoneNumber: n.phoneNumber, friendlyName: n.friendlyName })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load your Twilio numbers." },
      { status: 502 },
    );
  }
}
