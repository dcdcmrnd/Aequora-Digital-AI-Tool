import { NextRequest, NextResponse } from "next/server";

import { resumeRun } from "@/lib/automation/engine";
import { prisma } from "@/lib/prisma";

// 1x1 transparent PNG
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const tracking = await prisma.automationEmailTracking.findUnique({ where: { token: params.token } });

    if (tracking && !tracking.openedAt) {
      await prisma.automationEmailTracking.update({
        where: { id: tracking.id },
        data: { openedAt: new Date() },
      });

      const waitingRun = await prisma.automationRun.findFirst({
        where: { waitToken: params.token, status: "waiting" },
      });
      if (waitingRun) {
        await resumeRun(waitingRun.id);
      }
    }
  } catch {
    // Never fail the pixel response — tracking is best-effort.
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
