import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { createInvitation, buildInviteUrl, hashToken } from "@/lib/invite";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invitations = await prisma.invitation.findMany({
    where: { acceptedAt: null },
    include: { invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { email, name, role = "member", permissions = [], projectAccess = [] } = body;

  if (!email || !name) {
    return NextResponse.json({ error: "Email and name are required." }, { status: 400 });
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  // Check for pending invite
  const existingInvite = await prisma.invitation.findFirst({
    where: { email: email.toLowerCase().trim(), acceptedAt: null },
  });
  if (existingInvite && existingInvite.expiresAt > new Date()) {
    return NextResponse.json(
      { error: "A pending invite already exists for this email." },
      { status: 409 }
    );
  }

  const { token, invitation } = await createInvitation({
    email: email.toLowerCase().trim(),
    name,
    role,
    invitedById: session.user.id,
    permissions,
    projectAccess,
  });

  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/^﻿/, "").trim();
  const inviteUrl = buildInviteUrl(token, baseUrl);

  return NextResponse.json({ invitation, inviteUrl, token });
}
