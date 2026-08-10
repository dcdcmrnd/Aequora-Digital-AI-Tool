import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTwilioClient, isTwilioConfigured } from "@/lib/twilio";

/** Current calling number, if one has been purchased. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    phoneNumber: settings?.phoneNumber ?? null,
    twilioConfigured: isTwilioConfigured(),
  });
}

const purchaseSchema = z.object({ phoneNumber: z.string().min(1) });

/** Admin-only: buys the given available number from Twilio and sets it as the agency's calling number. Real recurring cost — confirmed client-side before this is called. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const parsed = purchaseSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const existing = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  if (existing?.phoneNumber) {
    return NextResponse.json(
      { error: "A calling number is already set up. Release it before purchasing another." },
      { status: 400 },
    );
  }

  try {
    const client = createTwilioClient();
    const purchased = await client.incomingPhoneNumbers.create({ phoneNumber: parsed.data.phoneNumber });

    await prisma.twilioSettings.upsert({
      where: { id: "singleton" },
      update: { phoneNumberSid: purchased.sid, phoneNumber: purchased.phoneNumber },
      create: { id: "singleton", phoneNumberSid: purchased.sid, phoneNumber: purchased.phoneNumber },
    });

    return NextResponse.json({ phoneNumber: purchased.phoneNumber }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't purchase this number." },
      { status: 502 },
    );
  }
}

/** Admin-only: releases the agency's calling number back to Twilio (stops the monthly charge). */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.phoneNumberSid) return NextResponse.json({ error: "No number to release." }, { status: 400 });

  try {
    const client = createTwilioClient();
    await client.incomingPhoneNumbers(settings.phoneNumberSid).remove();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't release this number." },
      { status: 502 },
    );
  }

  await prisma.twilioSettings.update({
    where: { id: "singleton" },
    data: { phoneNumberSid: null, phoneNumber: null },
  });

  return NextResponse.json({ success: true });
}
