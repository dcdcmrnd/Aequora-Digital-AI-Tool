import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import twilio from "twilio";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const connectSchema = z.object({
  accountSid: z.string().trim().min(1),
  authToken: z.string().trim().min(1),
});

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "https://app.aequoradigital.com";
}

/**
 * Admin-only: connects the agency's Twilio account from just the Account SID
 * + Auth Token shown on the Twilio Console home page — no manual API Key or
 * TwiML App setup required. We use those two credentials as master keys to
 * auto-provision a scoped API Key (what actually issues browser Voice
 * tokens) and a Voice TwiML App (pointed at our own /api/twilio/voice
 * webhook) via the Twilio REST API itself, then store everything. Twilio has
 * no public OAuth/"Connect" flow for third-party apps like this (unlike
 * Stripe Connect), so pasting these two values is the closest thing to
 * one-click that's actually possible.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = connectSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter both your Account SID and Auth Token." }, { status: 400 });
  const { accountSid, authToken } = parsed.data;

  if (!accountSid.startsWith("AC")) {
    return NextResponse.json({ error: "That doesn't look like an Account SID — it should start with \"AC\"." }, { status: 400 });
  }

  const client = twilio(accountSid, authToken);

  try {
    await client.api.v2010.accounts(accountSid).fetch();
  } catch {
    return NextResponse.json({ error: "Couldn't verify those credentials with Twilio. Double-check the Account SID and Auth Token." }, { status: 400 });
  }

  const existing = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });

  // Clean up whatever we auto-provisioned on a previous connect, so
  // reconnecting doesn't pile up orphaned API Keys / TwiML Apps in the
  // account. Best-effort — a previous key/app being already gone isn't fatal.
  if (existing?.apiKeySid) {
    await client.keys(existing.apiKeySid).remove().catch(() => {});
  }
  if (existing?.twimlAppSid) {
    await client.applications(existing.twimlAppSid).remove().catch(() => {});
  }

  let apiKeySid: string;
  let apiKeySecret: string;
  let twimlAppSid: string;
  try {
    const key = await client.newKeys.create({ friendlyName: "Aequora PM Voice" });
    apiKeySid = key.sid;
    apiKeySecret = key.secret;

    const app = await client.applications.create({
      friendlyName: "Aequora PM Voice",
      voiceUrl: `${baseUrl()}/api/twilio/voice`,
      voiceMethod: "POST",
      statusCallback: `${baseUrl()}/api/twilio/voice/status`,
      statusCallbackMethod: "POST",
    });
    twimlAppSid = app.sid;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connected, but couldn't finish setting up calling. Try again." },
      { status: 502 },
    );
  }

  await prisma.twilioSettings.upsert({
    where: { id: "singleton" },
    update: { accountSid, authToken, apiKeySid, apiKeySecret, twimlAppSid },
    create: { id: "singleton", accountSid, authToken, apiKeySid, apiKeySecret, twimlAppSid },
  });

  return NextResponse.json({ connected: true });
}

/** Admin-only: disconnects Twilio (does not release any purchased number — do that first). */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.twilioSettings.findUnique({ where: { id: "singleton" } });
  if (existing?.phoneNumber) {
    return NextResponse.json({ error: "Release your calling number before disconnecting Twilio." }, { status: 400 });
  }

  if (existing?.accountSid && existing.authToken) {
    const client = twilio(existing.accountSid, existing.authToken);
    if (existing.apiKeySid) await client.keys(existing.apiKeySid).remove().catch(() => {});
    if (existing.twimlAppSid) await client.applications(existing.twimlAppSid).remove().catch(() => {});
  }

  await prisma.twilioSettings.upsert({
    where: { id: "singleton" },
    update: { accountSid: null, authToken: null, apiKeySid: null, apiKeySecret: null, twimlAppSid: null },
    create: { id: "singleton" },
  });

  return NextResponse.json({ success: true });
}
