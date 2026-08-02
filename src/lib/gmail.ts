import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

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
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

/** All connected agency accounts, oldest-connected first. */
export async function getConnectedEmails(): Promise<string[]> {
  const tokens = await prisma.gmailToken.findMany({ select: { email: true }, orderBy: { updatedAt: "asc" } });
  return tokens.map((t) => t.email);
}

/** The default account — the first one connected — used when a caller doesn't specify which. */
export async function getConnectedEmail(): Promise<string | null> {
  const token = await prisma.gmailToken.findFirst({ orderBy: { updatedAt: "asc" } });
  return token?.email ?? null;
}

export async function getGmailClient(email?: string) {
  const token = email
    ? await prisma.gmailToken.findUnique({ where: { email } })
    : await prisma.gmailToken.findFirst({ orderBy: { updatedAt: "asc" } });

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
      where: { email: token.email },
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

function encodeEmail(fields: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${fields.from}`,
    `To: ${fields.to}`,
    `Subject: ${fields.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ];
  if (fields.inReplyTo) lines.push(`In-Reply-To: ${fields.inReplyTo}`);
  if (fields.references) lines.push(`References: ${fields.references}`);
  lines.push("", fields.body);

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Shared send path for the Inbox UI and Automation actions alike. */
export async function sendEmail(fields: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  /** When set, appends a 1x1 open-tracking pixel pointed at /api/track/open/{token}. */
  trackingToken?: string;
  /** Which connected agency account to send from. Defaults to the first connected account. */
  fromEmail?: string;
}): Promise<{ id: string | null | undefined; threadId: string | null | undefined }> {
  const gmail = await getGmailClient(fields.fromEmail);
  const senderEmail = fields.fromEmail ?? (await getConnectedEmail());

  const baseUrl = process.env.NEXTAUTH_URL || "https://app.aequoradigital.com";
  const body = fields.trackingToken
    ? `${fields.body}<img src="${baseUrl}/api/track/open/${fields.trackingToken}" width="1" height="1" style="display:none" alt="" />`
    : fields.body;

  const raw = encodeEmail({
    ...fields,
    body,
    from: `Aequora Digital <${senderEmail}>`,
  });

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: fields.threadId },
  });

  return { id: res.data.id, threadId: res.data.threadId };
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

export function getHeader(headers: { name?: string | null; value?: string | null }[], name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}
