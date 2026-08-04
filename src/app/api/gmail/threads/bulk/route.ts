import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { archiveThread, markThreadSpam, setThreadReadStatus, trashThread } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

const MAX_THREADS_PER_REQUEST = 100;

/** Bulk archive/spam/trash/mark-read/mark-unread for the thread-list multi-select toolbar. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadIds, action, scope, email } = await req.json();
  if (scope !== "own" && scope !== "agency") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (!["archive", "trash", "spam", "markRead", "markUnread"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!Array.isArray(threadIds) || threadIds.length === 0 || !threadIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "No conversations selected" }, { status: 400 });
  }
  if (threadIds.length > MAX_THREADS_PER_REQUEST) {
    return NextResponse.json({ error: `Select ${MAX_THREADS_PER_REQUEST} or fewer at a time` }, { status: 400 });
  }

  if (scope === "agency") {
    const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
    if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = scope === "own" ? session.user.id : null;

  try {
    await Promise.all(
      threadIds.map((id: string) => {
        if (action === "archive") return archiveThread(ownerId, email, id);
        if (action === "trash") return trashThread(ownerId, email, id);
        if (action === "spam") return markThreadSpam(ownerId, email, id);
        return setThreadReadStatus(ownerId, email, id, action === "markRead");
      }),
    );
    return NextResponse.json({ success: true, count: threadIds.length });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    if (err.message?.includes("not accessible")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: `Failed to ${action} the selected conversations` }, { status: 500 });
  }
}
