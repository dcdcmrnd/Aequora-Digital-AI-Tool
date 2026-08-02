import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", req.url));
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const { data } = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    if (!data.email) throw new Error("No email on Google account");

    // Multiple agency accounts can be connected side by side; reconnecting the
    // same account just refreshes its token instead of adding a duplicate.
    await prisma.gmailToken.upsert({
      where: { email: data.email },
      update: {
        accessToken: tokens.access_token!,
        // Google only returns a refresh_token on some grants even with
        // prompt=consent forced; keep the existing one if this grant omitted it.
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: BigInt(tokens.expiry_date ?? 0),
      },
      create: {
        email: data.email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? "",
        expiryDate: BigInt(tokens.expiry_date ?? 0),
      },
    });

    return NextResponse.redirect(new URL("/settings?connected=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?error=auth_failed", req.url));
  }
}
