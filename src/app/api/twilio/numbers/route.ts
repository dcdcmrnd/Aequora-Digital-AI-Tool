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
    twilioConfigured: await isTwilioConfigured(),
  });
}

const purchaseSchema = z
  .object({ phoneNumber: z.string().min(1).optional(), phoneNumberSid: z.string().min(1).optional() })
  .refine((d) => d.phoneNumber || d.phoneNumberSid, { message: "Provide a phoneNumber or phoneNumberSid." });

/**
 * Admin-only. Two modes:
 * - phoneNumber: buys that available number from Twilio (real recurring cost — confirmed client-side before this is called).
 * - phoneNumberSid: adopts a number already owned on the connected Twilio account (e.g. bought directly in the
 *   Twilio Console) as the agency's calling number — no purchase call, just registers it here.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await isTwilioConfigured())) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const parsed = purchaseSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const existing = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  if (existing?.phoneNumber) {
    return NextResponse.json(
      { error: "A calling number is already set up. Release it before adding another." },
      { status: 400 },
    );
  }

  try {
    const client = await createTwilioClient();

    const { sid, phoneNumber } = parsed.data.phoneNumberSid
      ? await client.incomingPhoneNumbers(parsed.data.phoneNumberSid).fetch()
      : await client.incomingPhoneNumbers.create({ phoneNumber: parsed.data.phoneNumber! });

    await prisma.twilioSettings.upsert({
      where: { id: "singleton" },
      update: { phoneNumberSid: sid, phoneNumber },
      create: { id: "singleton", phoneNumberSid: sid, phoneNumber },
    });

    return NextResponse.json({ phoneNumber }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't set up this number." },
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
    const client = await createTwilioClient();
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
