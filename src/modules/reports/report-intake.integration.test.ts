import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { submitReport, DuplicateReportError } from "./report-intake";
import { generateReporterToken } from "./reporter-token";

const REPORTER_HMAC_SECRET = "test-secret-with-at-least-32-bytes-for-hmac";

describe("Report Intake", () => {
  let serviceId: string;

  beforeAll(async () => {
    // Delete any existing test service first
    await prisma.service.deleteMany({
      where: { slug: "test-service" },
    });

    const service = await prisma.service.create({
      data: {
        name: "Test Service",
        slug: "test-service",
        category: "Developer Tools",
        ownerEmail: "test@example.internal",
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

  it("accepts a valid report", async () => {
    const token = generateReporterToken();
    const receipt = await submitReport(
      {
        serviceId,
        issueType: "UNAVAILABLE",
        note: "Cannot access service",
      },
      token,
      REPORTER_HMAC_SECRET
    );

    expect(receipt.reportId).toBeDefined();
    expect(receipt.acceptedAt).toBeInstanceOf(Date);
    expect(receipt.nextAllowedAt).toBeInstanceOf(Date);
    expect(receipt.serviceState).toBe("OPERATIONAL");

    const report = await prisma.report.findUnique({
      where: { id: receipt.reportId },
    });
    expect(report).toBeDefined();
    expect(report?.issueType).toBe("UNAVAILABLE");
  });

  it("rejects unsupported issue type", async () => {
    const token = generateReporterToken();
    await expect(
      submitReport(
        {
          serviceId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          issueType: "OTHER" as any,
          note: "Test note",
        },
        token,
        REPORTER_HMAC_SECRET
      )
    ).rejects.toThrow();
  });

  it("rejects note over 500 characters", async () => {
    const token = generateReporterToken();
    const longNote = "x".repeat(501);
    await expect(
      submitReport(
        {
          serviceId,
          issueType: "UNAVAILABLE",
          note: longNote,
        },
        token,
        REPORTER_HMAC_SECRET
      )
    ).rejects.toThrow();
  });

  it("rejects second report during cooldown", async () => {
    const token = generateReporterToken();

    // First report succeeds
    await submitReport(
      {
        serviceId,
        issueType: "UNAVAILABLE",
      },
      token,
      REPORTER_HMAC_SECRET
    );

    // Second report during cooldown fails
    await expect(
      submitReport(
        {
          serviceId,
          issueType: "SLOW",
        },
        token,
        REPORTER_HMAC_SECRET
      )
    ).rejects.toThrow(DuplicateReportError);

    try {
      await submitReport(
        {
          serviceId,
          issueType: "SLOW",
        },
        token,
        REPORTER_HMAC_SECRET
      );
    } catch (error) {
      if (error instanceof DuplicateReportError) {
        expect(error.nextAllowedAt).toBeInstanceOf(Date);
        expect(error.nextAllowedAt.getTime()).toBeGreaterThan(Date.now());
      }
    }

    // Verify only one report exists
    const reports = await prisma.report.findMany({ where: { serviceId } });
    expect(reports).toHaveLength(1);
  });

  it("accepts report after cooldown expires", async () => {
    const token = generateReporterToken();

    // Create a cooldown that expired 1 minute ago
    const service = await prisma.service.findUniqueOrThrow({
      where: { id: serviceId },
    });
    const pastCooldown = new Date(
      Date.now() - (service.thresholdWindowMinutes + 1) * 60 * 1000
    );

    const { hashReporterToken } = await import("./reporter-token");
    const tokenHmac = hashReporterToken(token, REPORTER_HMAC_SECRET);

    await prisma.reporterCooldown.create({
      data: {
        serviceId,
        reporterTokenHmac: tokenHmac,
        lastReportedAt: pastCooldown,
      },
    });

    // Should accept new report
    const receipt = await submitReport(
      {
        serviceId,
        issueType: "UNAVAILABLE",
      },
      token,
      REPORTER_HMAC_SECRET
    );

    expect(receipt.reportId).toBeDefined();
  });
});
