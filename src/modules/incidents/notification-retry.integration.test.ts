import { describe, it, expect, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { retryFailedNotification } from "@/modules/admin/owner-management";

describe("Notification Retry Integration", () => {
  let service: { id: string };
  let adminAccount: { id: string };

  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.incidentUpdate.deleteMany();
    await prisma.notificationJob.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.reporterCooldown.deleteMany();
    await prisma.report.deleteMany();
    await prisma.adminSession.deleteMany();
    await prisma.adminAccount.deleteMany();
    await prisma.service.deleteMany();

    service = await prisma.service.create({
      data: {
        name: "Test Service",
        slug: "test-service",
        category: "Developer Tools",
        ownerEmail: "owner@example.com",
        thresholdCount: 5,
        thresholdWindowMinutes: 10,
        issueTypes: ["UNAVAILABLE"],
        enabled: true,
        detectionArmed: true,
      },
    });

    adminAccount = await prisma.adminAccount.create({
      data: {
        username: "admin",
        passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
        displayName: "Admin User",
      },
    });
  });

  it("resets attempts counter and clears error state on manual retry", async () => {
    // Create an incident first
    const incident = await prisma.incident.create({
      data: {
        serviceId: service.id,
        state: "OPEN",
        thresholdCountSnapshot: 5,
        thresholdWindowSnapshot: 10,
        reportCountAtOpening: 5,
      },
    });

    // Create a failed notification job
    const job = await prisma.notificationJob.create({
      data: {
        incidentId: incident.id,
        notificationType: "INCIDENT_OPENED",
        recipientEmail: "owner@example.com",
        state: "FAILED",
        attempts: 3,
        lastError: "Previous error",
        lockedUntil: new Date(Date.now() + 60_000),
        nextAttempt: new Date(Date.now() - 1000),
      },
    });

    await retryFailedNotification(job.id, adminAccount.id);

    // Verify state reset
    const updated = await prisma.notificationJob.findUnique({
      where: { id: job.id },
    });

    expect(updated?.state).toBe("PENDING");
    expect(updated?.attempts).toBe(0);
    expect(updated?.lastError).toBeNull();
    expect(updated?.lockedUntil).toBeNull();
    expect(updated?.nextAttempt.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(updated?.nextAttempt.getTime()).toBeLessThanOrEqual(
      Date.now() + 1000,
    );
  });

  it("creates audit event with before/after state on retry", async () => {
    // Create an incident first
    const incident = await prisma.incident.create({
      data: {
        serviceId: service.id,
        state: "OPEN",
        thresholdCountSnapshot: 5,
        thresholdWindowSnapshot: 10,
        reportCountAtOpening: 5,
      },
    });

    const job = await prisma.notificationJob.create({
      data: {
        incidentId: incident.id,
        notificationType: "INCIDENT_OPENED",
        recipientEmail: "owner@example.com",
        state: "FAILED",
        attempts: 5,
        lastError: "Connection timeout",
        nextAttempt: new Date(Date.now() - 1000),
      },
    });

    await retryFailedNotification(job.id, adminAccount.id);

    // Verify audit event has before/after metadata
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "NOTIFICATION_RETRY",
        entityId: job.id,
      },
    });

    expect(auditEvent).toBeTruthy();
    expect(auditEvent?.metadata).toHaveProperty("before");
    expect(auditEvent?.metadata).toHaveProperty("after");

    const metadata = auditEvent?.metadata as Record<string, unknown>;
    const before = metadata.before as Record<string, unknown>;
    const after = metadata.after as Record<string, unknown>;
    expect(before.state).toBe("FAILED");
    expect(before.attempts).toBe(5);
    expect(after.state).toBe("PENDING");
    expect(after.attempts).toBe(0);
  });
});
