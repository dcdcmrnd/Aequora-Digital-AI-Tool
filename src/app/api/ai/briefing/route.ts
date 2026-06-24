import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai";
import { getAccessibleProjectIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  // Return cached briefing if already generated today
  const cached = await prisma.dailyBriefing.findUnique({
    where: { userId_date: { userId: session.user.id, date: todayStr } },
  });
  if (cached) return NextResponse.json({ briefing: cached.content, cached: true });

  // Check API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ briefing: null, cached: false });
  }

  try {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const projectIds = await getAccessibleProjectIds(session.user.id);

    const [overdueTasks, todayTasks, weekTasks] = await Promise.all([
      prisma.task.findMany({
        where: { assigneeId: session.user.id, projectId: { in: projectIds },
          dueDate: { lt: todayStart }, status: { not: "done" } },
        include: { project: { select: { name: true } } },
        orderBy: { priority: "asc" }, take: 10,
      }),
      prisma.task.findMany({
        where: { assigneeId: session.user.id, projectId: { in: projectIds },
          dueDate: { gte: todayStart, lt: tomorrowStart }, status: { not: "done" } },
        include: { project: { select: { name: true } } },
        orderBy: { priority: "asc" }, take: 10,
      }),
      prisma.task.findMany({
        where: { assigneeId: session.user.id, projectId: { in: projectIds },
          dueDate: { gte: tomorrowStart, lte: new Date(todayStart.getTime() + 7 * 86400000) },
          status: { not: "done" } },
        include: { project: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }], take: 5,
      }),
    ]);

    const formatTasks = (tasks: typeof overdueTasks) =>
      tasks.map((t) => `• [${t.priority}] ${t.title} (${t.project?.name ?? ""})`).join("\n") || "None";

    const prompt = `You are writing a short daily briefing for ${session.user.name}, a team member at Aequora Digital.

Today: ${today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

OVERDUE TASKS (${overdueTasks.length}):
${formatTasks(overdueTasks)}

DUE TODAY (${todayTasks.length}):
${formatTasks(todayTasks)}

DUE THIS WEEK (${weekTasks.length}):
${formatTasks(weekTasks)}

Write a friendly, concise 2-3 sentence briefing that:
1. Acknowledges the day and the workload situation
2. Highlights the most important focus (overdue items first, then today's tasks)
3. Ends with a brief motivating note

Keep it under 80 words. No bullet points — write in flowing prose. Be warm and direct.`;

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";

    // Cache the briefing for today
    await prisma.dailyBriefing.upsert({
      where: { userId_date: { userId: session.user.id, date: todayStr } },
      create: { userId: session.user.id, date: todayStr, content },
      update: { content },
    });

    return NextResponse.json({ briefing: content, cached: false });
  } catch (err) {
    console.error("Briefing generation error:", err);
    return NextResponse.json({ briefing: null, cached: false });
  }
}
