import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { loginRateLimiter } from "@/modules/auth/login-rate-limiter";
import { reportRateLimiter } from "@/modules/reports/rate-limiter";

const resetRequestSchema = z.object({
  mode: z.enum(["employee", "owner"]),
});

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse(null, { status: 404 });
  }

  const parsed = resetRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset mode" }, { status: 400 });
  }

  const passwordHash = await hashPassword("e2e-owner-password");

  await prisma.$transaction(async (tx) => {
    await tx.auditEvent.deleteMany();
    await tx.adminSession.deleteMany();
    await tx.adminAccount.deleteMany();
    await tx.incidentUpdate.deleteMany();
    await tx.notificationJob.deleteMany();
    await tx.incident.deleteMany();
    await tx.reporterCooldown.deleteMany();
    await tx.report.deleteMany();
    await tx.service.deleteMany();

    const service = await tx.service.create({
      data: {
        name: "Jira",
        slug: "jira",
        category: "Developer Tools",
        ownerEmail: "jira-owners@example.internal",
        thresholdCount: 2,
        thresholdWindowMinutes: 10,
        issueTypes: ["UNAVAILABLE", "SLOW", "LOGIN"],
        enabled: true,
        detectionArmed: parsed.data.mode === "employee",
      },
    });

    const owner = await tx.adminAccount.create({
      data: {
        username: "e2e-owner",
        passwordHash,
        displayName: "E2E Owner",
      },
    });

    if (parsed.data.mode === "owner") {
      const incident = await tx.incident.create({
        data: {
          serviceId: service.id,
          state: "OPEN",
          thresholdCountSnapshot: 2,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 2,
        },
      });

      await tx.incidentUpdate.create({
        data: {
          incidentId: incident.id,
          updateType: "OPENED",
          authorType: "SYSTEM",
          note: "Incident opened for E2E validation",
        },
      });
      await tx.notificationJob.create({
        data: {
          incidentId: incident.id,
          notificationType: "OPENING",
          recipientEmail: service.ownerEmail,
          nextAttempt: new Date(),
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        accountId: owner.id,
        action: "E2E_RESET",
        entityType: "SERVICE",
        entityId: service.id,
        metadata: { mode: parsed.data.mode },
      },
    });
  });

  loginRateLimiter.reset();
  reportRateLimiter.reset();

  return NextResponse.json({ ok: true });
}

function isAuthorized(request: NextRequest): boolean {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.E2E_TEST_MODE !== "1"
  ) {
    return false;
  }

  const secret = process.env.E2E_RESET_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !supplied) return false;

  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}
