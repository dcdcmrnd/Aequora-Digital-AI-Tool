import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const SHARED_EMAIL = "info@aequoradigital.com";

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.modify"],
    login_hint: SHARED_EMAIL,
  });
}

export async function getGmailClient() {
  const token = await prisma.gmailToken.findUnique({
    where: { email: SHARED_EMAIL },
  });

  if (!token) throw new Error("Gmail not connected. Visit /api/gmail/auth to connect.");

  const client = createOAuthClient();
  client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: Number(token.expiryDate),
  });

  // Auto-refresh if expired
  const expiry = Number(token.expiryDate);
  if (Date.now() > expiry - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    await prisma.gmailToken.update({
      where: { email: SHARED_EMAIL },
      data: {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token ?? token.refreshToken,
        expiryDate: BigInt(credentials.expiry_date ?? 0),
      },
    });
    client.setCredentials(credentials);
  }

  return google.gmail({ version: "v1", auth: client });
}

export function decodeBody(data?: string | null): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

export function extractBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  function walk(part: any) {
    const mime = part.mimeType ?? "";
    if (mime === "text/html") html = decodeBody(part.body?.data);
    else if (mime === "text/plain" && !html) text = decodeBody(part.body?.data);
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return { html, text };
}

export function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}
