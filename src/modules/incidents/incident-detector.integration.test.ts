import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { submitReport } from "../reports/report-intake";
import { generateReporterToken } from "../reports/reporter-token";
import { evaluateService } from "./incident-detector";

const REPORTER_HMAC_SECRET = "test-secret-with-at-least-32-bytes-for-hmac";

describe("Incident Detector", () => {
  let serviceId: string;

  beforeAll(async () => {
    // Delete any existing test data first
    const existingService = await prisma.service.findUnique({
      where: { slug: "detector-test-service" },
    });

    if (existingService) {
      await prisma.notificationJob.deleteMany({
        where: { incident: { serviceId: existingService.id } },
      });
      await prisma.incident.deleteMany({
        where: { serviceId: existingService.id },
      });
      await prisma.service.delete({
        where: { id: existingService.id },
      });
    }

    const service = await prisma.service.create({
      data: {
        name: "Detector Test Service",
        slug: "detector-test-service",
        category: "Developer Tools",
        ownerEmail: "detector-test@example.internal",
        thresholdCount: 3,
        thresholdWindowMinutes: 10,
        issueTypes: ["UNAVAILABLE", "SLOW"],
        enabled: true,
      },
    });
    serviceId = service.id;
  });

  beforeEach(async () => {
    await prisma.report.deleteMany({ where: { serviceId } });
    await prisma.reporterCooldown.deleteMany({ where: { serviceId } });
    await prisma.notificationJob.deleteMany();
    await prisma.incident.deleteMany({ where: { serviceId } });
    await prisma.service.update({
      where: { id: serviceId },
      data: { detectionArmed: true },
    });
  });

  it("creates exactly one incident when threshold is reached", async () => {
    // Submit threshold number of reports from different tokens
    const tokens = [
      generateReporterToken(),
      generateReporterToken(),
      generateReporterToken(),
    ];

    for (const token of tokens) {
      await submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
        },
        token,
        REPORTER_HMAC_SECRET
      );
    }

    // Verify exactly one incident was created
    const incidents = await prisma.incident.findMany({
      where: { serviceId },
    });
    expect(incidents).toHaveLength(1);
    expect(incidents[0].state).toBe("OPEN");
  });

  it("creates exactly one OPENING notification job", async () => {
    // Submit threshold number of reports
    const tokens = [
      generateReporterToken(),
      generateReporterToken(),
      generateReporterToken(),
    ];

    for (const token of tokens) {
      await submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
        },
        token,
        REPORTER_HMAC_SECRET
      );
    }

    // Verify exactly one notification job was created
    const jobs = await prisma.notificationJob.findMany({
      where: {
        incident: { serviceId },
        notificationType: "OPENING",
      },
    });
    expect(jobs).toHaveLength(1);
  });

  it("creates exactly one incident under concurrent threshold submissions", async () => {
    // Submit threshold reports concurrently
    const tokens = [
      generateReporterToken(),
      generateReporterToken(),
      generateReporterToken(),
      generateReporterToken(), // Extra to test race condition
    ];

    const results = await Promise.allSettled(
      tokens.map((token) =>
        submitReport(
          {
            serviceId,
            issueType: "UNAVAILABLE",
          },
          token,
          REPORTER_HMAC_SECRET
        )
      )
    );

    // Check results
    const succeeded = results.filter((r) => r.status === "fulfilled");
    expect(succeeded.length).toBeGreaterThanOrEqual(2);

    // Now trigger concurrent evaluation to test race conditions in incident creation
    await Promise.allSettled([
      evaluateService(serviceId),
      evaluateService(serviceId),
      evaluateService(serviceId),
    ]);

    // The critical assertion: only one incident should exist
    const incidents = await prisma.incident.findMany({
      where: { serviceId },
    });
    expect(incidents).toHaveLength(1);

    // And only one notification job
    const jobs = await prisma.notificationJob.findMany({
      where: {
        incident: { serviceId },
        notificationType: "OPENING",
      },
    });
    expect(jobs).toHaveLength(1);
  });

  it("does not create another incident when one is already open", async () => {
    // Submit initial reports to create incident
    for (let i = 0; i < 3; i++) {
      await submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
        },
        generateReporterToken(),
        REPORTER_HMAC_SECRET
      );
    }

    const initialIncidents = await prisma.incident.count({
      where: { serviceId },
    });
    expect(initialIncidents).toBe(1);

    // Submit more reports
    for (let i = 0; i < 3; i++) {
      await submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
        },
        generateReporterToken(),
        REPORTER_HMAC_SECRET
      );
    }

    // Still only one incident
    const finalIncidents = await prisma.incident.count({
      where: { serviceId },
    });
    expect(finalIncidents).toBe(1);
  });

  it("re-arms detection only after count drops below threshold", async () => {
    // Submit threshold reports
    for (let i = 0; i < 3; i++) {
      await submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
        },
        generateReporterToken(),
        REPORTER_HMAC_SECRET
      );
    }

    // Incident should be created and detection disarmed
    let service = await prisma.service.findUniqueOrThrow({
      where: { id: serviceId },
    });
    expect(service.detectionArmed).toBe(false);

    // Resolve the incident
    const incident = await prisma.incident.findFirstOrThrow({
      where: { serviceId },
    });
    await prisma.incident.update({
      where: { id: incident.id },
      data: { state: "RESOLVED", resolvedAt: new Date() },
    });

    // Manually set old reports to be outside the window
    const oldDate = new Date(Date.now() - 11 * 60 * 1000);
    await prisma.report.updateMany({
      where: { serviceId },
      data: { reportedAt: oldDate },
    });

    // Trigger evaluation
    await evaluateService(serviceId);

    // Detection should be re-armed
    service = await prisma.service.findUniqueOrThrow({
      where: { id: serviceId },
    });
    expect(service.detectionArmed).toBe(true);

    // New threshold crossing should create new incident
    for (let i = 0; i < 3; i++) {
      await submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
        },
        generateReporterToken(),
        REPORTER_HMAC_SECRET
      );
    }

    const incidents = await prisma.incident.findMany({
      where: { serviceId },
    });
    expect(incidents).toHaveLength(2);
  });
});
