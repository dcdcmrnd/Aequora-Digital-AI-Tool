import { prisma } from "@/lib/prisma";

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  entityName,
  metadata = {},
}: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        entityName,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {
    // Non-fatal — activity logging should never break the main operation
  }
}

export async function createNotification({
  userId,
  type,
  title,
  body,
  entityType,
  entityId,
}: {
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, entityType, entityId },
    });
  } catch {
    // Non-fatal
  }
}
