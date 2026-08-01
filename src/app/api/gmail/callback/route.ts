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

    // Only one agency inbox is supported — connecting a new account replaces the old one.
    await prisma.gmailToken.deleteMany({});
    await prisma.gmailToken.create({
      data: {
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
