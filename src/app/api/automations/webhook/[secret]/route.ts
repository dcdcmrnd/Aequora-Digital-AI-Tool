import { NextRequest, NextResponse } from "next/server";

import { runInboundWebhook } from "@/lib/automation/engine";

// Unauthenticated by design -- external senders (Zapier, GHL, a form host, etc.) can't do
// interactive login, so the secret in the URL is the only credential. Keep it out of logs/UIs
// that aren't the automation builder itself, and use "Regenerate" there if it ever leaks.
export async function POST(req: NextRequest, { params }: { params: { secret: string } }) {
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    // No body, or not JSON -- proceed with an empty payload rather than failing the request.
  }

  const result = await runInboundWebhook(params.secret, payload);
  if (result === "not_found") {
    return NextResponse.json({ error: "Unknown or inactive webhook" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
