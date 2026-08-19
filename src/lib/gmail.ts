import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/utils/retry";

/**
 * Gmail's per-user send quota is tight enough that a handful of automation
 * steps firing at once (e.g. bulk "Push to Next Step" across several
 * contacts) routinely trips it — "Too many concurrent requests for user" or
 * "Quota exceeded ... Units per minute per user". Both are transient: the
 * quota window clears within seconds, so this is worth a few spaced-out
 * retries instead of immediately failing the automation run.
 */
function isGmailRateLimitError(error: unknown): boolean {
  const code = (error as { code?: number })?.code;
  const status = (error as { response?: { status?: number } })?.response?.status;
  const message = error instanceof Error ? error.message : String(error);
  return code === 429 || status === 429 || /too many concurrent requests|quota exceeded/i.test(message);
}

/**
 * Serializes actual Gmail send calls with a minimum spacing between them,
 * shared across every caller in this process — bulk automation pushes,
 * individual automation sends, and Inbox replies alike. Retrying after a 429
 * (above) only reacts once the quota's already been tripped; pacing calls
 * out up front means a burst (e.g. bulk-pushing hundreds of contacts through
 * a Send Email step) mostly never trips it in the first place.
 */
let gmailSendChain: Promise<void> = Promise.resolve();
let lastGmailSendAt = 0;
const MIN_GMAIL_SEND_INTERVAL_MS = 1_100;

function throttleGmailSend<T>(fn: () => Promise<T>): Promise<T> {
  const scheduled = gmailSendChain.then(async () => {
    const wait = Math.max(0, lastGmailSendAt + MIN_GMAIL_SEND_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGmailSendAt = Date.now();
  });
  // Keep the chain alive even if this scheduling step's wait somehow rejects --
  // otherwise every send queued behind it would inherit the rejection too.
  gmailSendChain = scheduled.catch(() => {});
  return scheduled.then(fn);
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(scope: "agency" | "personal" = "agency") {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: scope,
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

/** Connected accounts for the given owner (null = shared agency account), primary first (if set), then oldest-connected. */
export async function getConnectedEmails(ownerId: string | null): Promise<string[]> {
  const tokens = await prisma.gmailToken.findMany({
    where: { ownerId },
    select: { email: true },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "asc" }],
  });
  return tokens.map((t) => t.email);
}

/** Same ordering as getConnectedEmails, but also reports which one is primary — for the Settings UI. */
export async function getConnectedEmailsWithPrimary(ownerId: string | null): Promise<{ email: string; isPrimary: boolean }[]> {
  const tokens = await prisma.gmailToken.findMany({
    where: { ownerId },
    select: { email: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "asc" }],
  });
  return tokens;
}

/** The default account for the given owner — the one marked primary, falling back to the first connected — used when a caller doesn't specify which. */
export async function getConnectedEmail(ownerId: string | null): Promise<string | null> {
  const token = await prisma.gmailToken.findFirst({ where: { ownerId }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "asc" }] });
  return token?.email ?? null;
}

export async function getGmailClient(ownerId: string | null, email?: string) {
  const token = email
    ? await prisma.gmailToken.findUnique({ where: { email } })
    : await prisma.gmailToken.findFirst({ where: { ownerId }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "asc" }] });

  if (!token) throw new Error("Gmail not connected. Visit /api/gmail/auth to connect.");
  if (email && token.ownerId !== ownerId) throw new Error("Gmail account not accessible.");

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

/** Removes the thread from Inbox (stays searchable in All Mail) — matches Gmail's own "Archive" button. */
export async function archiveThread(ownerId: string | null, email: string, threadId: string): Promise<void> {
  const gmail = await getGmailClient(ownerId, email);
  await gmail.users.threads.modify({ userId: "me", id: threadId, requestBody: { removeLabelIds: ["INBOX"] } });
}

/** Moves the thread to Trash (reversible for 30 days) — matches Gmail's own "Delete" button. */
export async function trashThread(ownerId: string | null, email: string, threadId: string): Promise<void> {
  const gmail = await getGmailClient(ownerId, email);
  await gmail.users.threads.trash({ userId: "me", id: threadId });
}

/** Moves the thread to Spam — matches Gmail's own "Report spam" button. */
export async function markThreadSpam(ownerId: string | null, email: string, threadId: string): Promise<void> {
  const gmail = await getGmailClient(ownerId, email);
  await gmail.users.threads.modify({ userId: "me", id: threadId, requestBody: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] } });
}

/** Sets the UNREAD label across every message in the thread. */
export async function setThreadReadStatus(ownerId: string | null, email: string, threadId: string, read: boolean): Promise<void> {
  const gmail = await getGmailClient(ownerId, email);
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: read ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] },
  });
}

/** Strips CR/LF so header values can't inject extra headers (e.g. a stray Bcc). */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeEmail(fields: {
  to: string;
  from: string;
  subject: string;
  body: string;
  cc?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${sanitizeHeaderValue(fields.from)}`,
    `To: ${sanitizeHeaderValue(fields.to)}`,
    ...(fields.cc ? [`Cc: ${sanitizeHeaderValue(fields.cc)}`] : []),
    `Subject: ${sanitizeHeaderValue(fields.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ];
  if (fields.inReplyTo) lines.push(`In-Reply-To: ${sanitizeHeaderValue(fields.inReplyTo)}`);
  if (fields.references) lines.push(`References: ${sanitizeHeaderValue(fields.references)}`);
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
  cc?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  /** When set, appends a 1x1 open-tracking pixel pointed at /api/track/open/{token}. */
  trackingToken?: string;
  /** Which connected account to send from. Defaults to the first connected account for the given owner. */
  fromEmail?: string;
}, ownerId: string | null): Promise<{ id: string | null | undefined; threadId: string | null | undefined }> {
  const gmail = await getGmailClient(ownerId, fields.fromEmail);
  const senderEmail = fields.fromEmail ?? (await getConnectedEmail(ownerId));

  const baseUrl = process.env.NEXTAUTH_URL || "https://app.aequoradigital.com";
  const body = fields.trackingToken
    ? `${fields.body}<img src="${baseUrl}/api/track/open/${fields.trackingToken}" width="1" height="1" style="display:none" alt="" />`
    : fields.body;

  const raw = encodeEmail({
    ...fields,
    body,
    from: `Aequora Digital <${senderEmail}>`,
  });

  const res = await throttleGmailSend(() =>
    withRetry(
      () => gmail.users.messages.send({ userId: "me", requestBody: { raw, threadId: fields.threadId } }),
      {
        retries: 4,
        backoffMs: 3_000,
        shouldRetry: isGmailRateLimitError,
      },
    ),
  );

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

/** Pulls a display name + email out of a "Name" <email> style header — the other party on a thread (sender for received mail, recipient for sent mail). */
export function extractContact(from: string, to: string, isOutgoing: boolean) {
  const raw = isOutgoing ? to : from;
  const match = raw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return {
    name: match?.[1]?.trim() || raw,
    email: match?.[2]?.trim() || raw,
  };
}
