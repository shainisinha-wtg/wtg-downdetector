import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DATABASE_TIMEOUT_MS = 2_000;

export async function GET() {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1 AS result`);
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database readiness check timed out")),
          DATABASE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
