import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { claimDueJobs, deliverJob } from "./job-repository";

describe("notification job repository", () => {
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
  });

  it("prevents concurrent claimers from claiming the same jobs", async () => {
    const jobs = await createJobs(4);

    const [firstClaim, secondClaim] = await Promise.all([
      claimDueJobs(2),
      claimDueJobs(2),
    ]);
    const claimedIds = [...firstClaim, ...secondClaim].map((job) => job.id);

    expect(claimedIds).toHaveLength(4);
    expect(new Set(claimedIds)).toHaveLength(4);
    expect(claimedIds).toEqual(
      expect.arrayContaining(jobs.map((job) => job.id)),
    );
  });

  it("marks a delivered job as sent", async () => {
    const [job] = await createJobs(1);
    const [claimedJob] = await claimDueJobs(1);
    const sentMessages: Array<{ to: string; subject: string }> = [];

    await deliverJob(claimedJob.id, async (message) => {
      sentMessages.push({ to: message.to, subject: message.subject });
    });

    const deliveredJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(deliveredJob.state).toBe("SENT");
    expect(deliveredJob.attempts).toBe(1);
    expect(deliveredJob.deliveredAt).not.toBeNull();
    expect(deliveredJob.lockedUntil).toBeNull();
    expect(sentMessages).toEqual([
      {
        to: "owners@example.internal",
        subject: expect.stringContaining("Jira"),
      },
    ]);
  });

  it("schedules a bounded exponential retry after a transient failure", async () => {
    const [job] = await createJobs(1);
    await claimDueJobs(1);
    const beforeFailure = new Date();

    await expect(
      deliverJob(job.id, async () => {
        throw new Error("Temporary SMTP failure");
      }),
    ).rejects.toThrow("Temporary SMTP failure");

    const retriedJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    const retryDelay =
      retriedJob.nextAttempt.getTime() - beforeFailure.getTime();
    expect(retriedJob.state).toBe("PENDING");
    expect(retriedJob.attempts).toBe(1);
    expect(retriedJob.lastError).toBe("Temporary SMTP failure");
    expect(retriedJob.lockedUntil).toBeNull();
    expect(retryDelay).toBeGreaterThanOrEqual(45_000);
    expect(retryDelay).toBeLessThanOrEqual(75_000);
  });

  it("marks the eighth failed attempt as permanently failed", async () => {
    const [job] = await createJobs(1, 7);
    await claimDueJobs(1);

    await expect(
      deliverJob(job.id, async () => {
        throw new Error("Permanent SMTP failure");
      }),
    ).rejects.toThrow("Permanent SMTP failure");

    const failedJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(failedJob.state).toBe("FAILED");
    expect(failedJob.attempts).toBe(8);
    expect(failedJob.lockedUntil).toBeNull();
  });
});

async function createJobs(count: number, attempts = 0) {
  const service = await prisma.service.create({
    data: {
      name: "Jira",
      slug: `jira-${crypto.randomUUID()}`,
      category: "Developer Tools",
      ownerEmail: "owners@example.internal",
      thresholdCount: 10,
      thresholdWindowMinutes: 10,
      issueTypes: ["UNAVAILABLE", "SLOW"],
    },
  });
  const incident = await prisma.incident.create({
    data: {
      serviceId: service.id,
      thresholdCountSnapshot: 10,
      thresholdWindowSnapshot: 10,
      reportCountAtOpening: 2,
      openedAt: new Date(),
    },
  });
  await prisma.report.createMany({
    data: [
      {
        serviceId: service.id,
        reporterTokenHmac: crypto.randomUUID(),
        issueType: "UNAVAILABLE",
        reportedAt: new Date(Date.now() - 60_000),
      },
      {
        serviceId: service.id,
        reporterTokenHmac: crypto.randomUUID(),
        issueType: "SLOW",
        reportedAt: new Date(Date.now() - 30_000),
      },
    ],
  });

  return Promise.all(
    Array.from({ length: count }, () =>
      prisma.notificationJob.create({
        data: {
          incidentId: incident.id,
          notificationType: "OPENING",
          recipientEmail: "owners@example.internal",
          nextAttempt: new Date(Date.now() - 1_000),
          attempts,
        },
      }),
    ),
  );
}
