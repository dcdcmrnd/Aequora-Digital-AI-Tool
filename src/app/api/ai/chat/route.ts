import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission, getAccessibleProjectIds } from "@/lib/permissions";
import {
  getAnthropicClient,
  AEQUORA_BUSINESS_CONTEXT,
  buildTaskAssistantSystemPrompt,
} from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, mode } = await req.json();
  if (!message || !mode) {
    return NextResponse.json({ error: "message and mode required." }, { status: 400 });
  }

  const isAdmin = session.user.role === "admin";

  // Permission check
  const permType = mode === "consultant" ? "ai.consultant" : "ai.task_assistant";
  const hasAccess = isAdmin || await checkPermission(session.user.id, permType);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to .env.local." }, { status: 503 });
  }

  // Load or create chat history
  let chat = await prisma.aiChat.findUnique({
    where: { userId_mode: { userId: session.user.id, mode } },
  });

  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (chat) {
    try {
      history = JSON.parse(chat.messages);
    } catch {}
  }

  // Build system prompt
  let systemPrompt = AEQUORA_BUSINESS_CONTEXT;

  if (mode === "task-assistant") {
    const projectIds = await getAccessibleProjectIds(session.user.id);
    const [tasks, recentActivity] = await Promise.all([
      prisma.task.findMany({
        where: {
          assigneeId: session.user.id,
          projectId: { in: projectIds },
          status: { not: "done" },
        },
        include: { project: { select: { name: true } } },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        take: 30,
      }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
    ]);

    systemPrompt = buildTaskAssistantSystemPrompt({
      userName: session.user.name ?? "Team member",
      userRole: session.user.role,
      today: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
        projectName: t.project.name,
      })),
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        entityType: a.entityType,
        entityName: a.entityName,
        userName: a.user.name,
        createdAt: a.createdAt.toLocaleString(),
      })),
    });
  }

  const anthropic = getAnthropicClient();

  // Add new user message
  history.push({ role: "user", content: message });

  // Keep context window manageable — last 40 messages
  const trimmedHistory = history.slice(-40);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: trimmedHistory,
  });

  const reply =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Append assistant reply
  history.push({ role: "assistant", content: reply });

  // Persist
  const messagesJson = JSON.stringify(history.slice(-60));
  if (chat) {
    await prisma.aiChat.update({
      where: { userId_mode: { userId: session.user.id, mode } },
      data: { messages: messagesJson },
    });
  } else {
    await prisma.aiChat.create({
      data: {
        userId: session.user.id,
        mode,
        messages: messagesJson,
      },
    });
  }

  return NextResponse.json({ reply, history: history.slice(-60) });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "task-assistant";

  const chat = await prisma.aiChat.findUnique({
    where: { userId_mode: { userId: session.user.id, mode } },
  });

  let messages: { role: string; content: string }[] = [];
  if (chat) {
    try {
      messages = JSON.parse(chat.messages);
    } catch {}
  }

  return NextResponse.json({ messages });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "task-assistant";

  await prisma.aiChat.deleteMany({
    where: { userId: session.user.id, mode },
  });

  return NextResponse.json({ success: true });
}
