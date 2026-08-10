import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createTwilioClient, isTwilioConfigured } from "@/lib/twilio";

/** Admin-only: searches Twilio for available US local numbers to purchase, optionally narrowed by area code. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await isTwilioConfigured())) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const areaCode = req.nextUrl.searchParams.get("areaCode");

  try {
    const client = await createTwilioClient();
    const results = await client
      .availablePhoneNumbers("US")
      .local.list({ ...(areaCode ? { areaCode: Number(areaCode) } : {}), limit: 10 });

    return NextResponse.json({
      numbers: results.map((r) => ({
        phoneNumber: r.phoneNumber,
        friendlyName: r.friendlyName,
        locality: r.locality,
        region: r.region,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't search for numbers." },
      { status: 502 },
    );
  }
}
