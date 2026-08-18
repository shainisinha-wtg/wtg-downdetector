import { describe, it, expect, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { updateServiceConfiguration } from "@/modules/admin/owner-management";

describe("Service Update Audit Integration", () => {
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
        ownerEmail: "original@example.com",
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

  it("captures before/after state in audit event for service updates", async () => {
    await updateServiceConfiguration(
      {
        serviceId: service.id,
        thresholdCount: 10,
        thresholdWindowMinutes: 20,
        ownerEmail: "new@example.com",
        issueTypes: ["UNAVAILABLE", "SLOW"],
      },
      adminAccount.id,
    );

    // Verify audit event has before/after metadata
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "SERVICE_UPDATED",
        entityId: service.id,
      },
    });

    expect(auditEvent).toBeTruthy();
    expect(auditEvent?.metadata).toHaveProperty("before");
    expect(auditEvent?.metadata).toHaveProperty("after");

    const metadata = auditEvent?.metadata as Record<string, unknown>;
    const before = metadata.before as Record<string, unknown>;
    const after = metadata.after as Record<string, unknown>;

    // Verify before values
    expect(before.ownerEmail).toBe("original@example.com");
    expect(before.thresholdCount).toBe(5);
    expect(before.thresholdWindowMinutes).toBe(10);
    expect(before.enabled).toBe(true);
    expect(before.issueTypes).toEqual(["UNAVAILABLE"]);

    // Verify after values
    expect(after.ownerEmail).toBe("new@example.com");
    expect(after.thresholdCount).toBe(10);
    expect(after.thresholdWindowMinutes).toBe(20);
    expect(after.enabled).toBe(true);
    expect(after.issueTypes).toEqual(["UNAVAILABLE", "SLOW"]);
  });

  it("includes all editable fields in audit trail", async () => {
    await updateServiceConfiguration(
      {
        serviceId: service.id,
        thresholdCount: 15,
        thresholdWindowMinutes: 30,
        ownerEmail: "updated@example.com",
        issueTypes: ["LOGIN", "CONNECTIVITY"],
      },
      adminAccount.id,
    );

    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "SERVICE_UPDATED",
        entityId: service.id,
      },
    });

    const metadata = auditEvent?.metadata as Record<string, unknown>;
    const before = metadata.before as Record<string, unknown>;
    const after = metadata.after as Record<string, unknown>;

    // Verify all key fields are tracked
    expect(before).toHaveProperty("thresholdCount");
    expect(before).toHaveProperty("thresholdWindowMinutes");
    expect(before).toHaveProperty("ownerEmail");
    expect(before).toHaveProperty("enabled");
    expect(before).toHaveProperty("issueTypes");

    expect(after).toHaveProperty("thresholdCount");
    expect(after).toHaveProperty("thresholdWindowMinutes");
    expect(after).toHaveProperty("ownerEmail");
    expect(after).toHaveProperty("enabled");
    expect(after).toHaveProperty("issueTypes");
  });
});
