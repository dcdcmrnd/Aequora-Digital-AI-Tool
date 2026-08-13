import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUsPhoneNumber } from "@/lib/twilio";

const createCallSchema = z.object({
  contactId: z.string().optional(),
  toNumber: z.string().min(1),
});

const PAGE_SIZE = 25;

/** Every call across every contact, most recent first — backs the standalone Calls page. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      include: {
        contact: { select: { id: true, name: true, company: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.call.count(),
  ]);

  return NextResponse.json({ calls, total, page, pageSize: PAGE_SIZE });
}

/**
 * Creates a call record right before the browser Device dials — the TwiML
 * webhook (unauthenticated, Twilio-only) looks it up by id to know the
 * caller ID and log status against. Normalizes the contact's (free-text)
 * phone number to E.164 here so the client can dial exactly what's returned,
 * rather than duplicating normalization logic on both sides.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createCallSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const toNumber = normalizeUsPhoneNumber(parsed.data.toNumber);
  if (!toNumber) {
    return NextResponse.json({ error: "Enter a valid US phone number." }, { status: 400 });
  }

  const settings = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.phoneNumber) {
    return NextResponse.json(
      { error: "No calling number set up yet. Ask an admin to add one in Settings → Calling." },
      { status: 400 },
    );
  }

  const call = await prisma.call.create({
    data: {
      contactId: parsed.data.contactId,
      userId: session.user.id,
      toNumber,
      fromNumber: settings.phoneNumber,
      status: "queued",
    },
  });

  return NextResponse.json({ callId: call.id, toNumber, fromNumber: settings.phoneNumber });
}
