import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const SHARED_EMAIL = "info@aequoradigital.com";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/inbox?error=no_code", req.url));
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await client.getToken(code);

    await prisma.gmailToken.upsert({
      where: { email: SHARED_EMAIL },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? "",
        expiryDate: BigInt(tokens.expiry_date ?? 0),
      },
      create: {
        email: SHARED_EMAIL,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? "",
        expiryDate: BigInt(tokens.expiry_date ?? 0),
      },
    });

    return NextResponse.redirect(new URL("/inbox?connected=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/inbox?error=auth_failed", req.url));
  }
}
