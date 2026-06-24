import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateInviteToken, hashToken } from "@/lib/invite";
import { logActivity } from "@/lib/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const result = await validateInviteToken(params.token);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const inv = result.invitation!;
  return NextResponse.json({
    invitation: {
      email: inv.email,
      name: inv.name,
      role: inv.role,
      invitedBy: inv.invitedBy,
      expiresAt: inv.expiresAt,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const result = await validateInviteToken(params.token);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const inv = result.invitation!;
  const body = await req.json();
  const { name, password } = body;

  if (!name || !password) {
    return NextResponse.json({ error: "Name and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  // Parse stored permissions and project access
  let defaultPermissions: string[] = [];
  let projectAccess: { projectId: string; accessLevel: string }[] = [];
  try {
    defaultPermissions = JSON.parse(inv.defaultPermissions || "[]");
    projectAccess = JSON.parse(inv.projectAccess || "[]");
  } catch {}

  // Create user in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email: inv.email,
        password: hashed,
        role: inv.role as "admin" | "member",
        status: "active",
        activatedAt: new Date(),
        invitedAt: inv.createdAt,
      },
    });

    // Grant permissions
    for (const perm of defaultPermissions) {
      await tx.userPermission.upsert({
        where: { userId_permissionType: { userId: newUser.id, permissionType: perm } },
        update: {},
        create: { userId: newUser.id, permissionType: perm },
      });
    }

    // Grant project access
    for (const pa of projectAccess) {
      await tx.projectAccess.upsert({
        where: { userId_projectId: { userId: newUser.id, projectId: pa.projectId } },
        update: { accessLevel: pa.accessLevel },
        create: {
          userId: newUser.id,
          projectId: pa.projectId,
          accessLevel: pa.accessLevel,
          grantedById: inv.invitedById,
        },
      });
    }

    // Mark invite as accepted
    await tx.invitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date() },
    });

    return newUser;
  });

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "user",
    entityId: user.id,
    entityName: user.name,
    metadata: { via: "invite" },
  });

  return NextResponse.json({ success: true, userId: user.id });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Revoke invite — admin only
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const { checkPermission } = await import("@/lib/permissions");

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = await checkPermission(session.user.id, "admin.users");
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hashedToken = hashToken(params.token);
  await prisma.invitation.deleteMany({ where: { token: hashedToken } });
  return NextResponse.json({ success: true });
}
