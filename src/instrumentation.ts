export async function register() {
  // Only run in Node.js runtime (not Edge), and only when a real DB is configured
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith("file:")
  ) {
    try {
      const { execSync } = await import("child_process");
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        stdio: "inherit",
      });
    } catch (e) {
      console.error("[instrumentation] prisma db push failed:", e);
    }
  }
}
