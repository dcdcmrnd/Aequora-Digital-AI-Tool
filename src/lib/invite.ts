import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const INVITE_EXPIRY_HOURS = 72;

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createInvitation({
  email,
  name,
  role,
  invitedById,
  permissions,
  projectAccess,
}: {
  email: string;
  name: string;
  role: "admin" | "member";
  invitedById: string;
  permissions: string[];
  projectAccess: { projectId: string; accessLevel: string }[];
}): Promise<{ token: string; invitation: any }> {
  const rawToken = generateInviteToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      name,
      role,
      invitedById,
      token: hashedToken,
      expiresAt,
      defaultPermissions: JSON.stringify(permissions),
      projectAccess: JSON.stringify(projectAccess),
    },
    include: { invitedBy: { select: { name: true, email: true } } },
  });

  return { token: rawToken, invitation };
}

export async function validateInviteToken(rawToken: string) {
  const hashedToken = hashToken(rawToken);

  const invitation = await prisma.invitation.findUnique({
    where: { token: hashedToken },
    include: { invitedBy: { select: { name: true, email: true } } },
  });

  if (!invitation) return { valid: false, error: "Invalid invite link." };
  if (invitation.acceptedAt) return { valid: false, error: "This invite has already been used." };
  if (invitation.expiresAt < new Date()) return { valid: false, error: "This invite has expired. Request a new invite from your admin." };

  return { valid: true, invitation };
}

export function buildInviteUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/invite/${token}`;
}
