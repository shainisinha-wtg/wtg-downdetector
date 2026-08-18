import { randomInt } from "node:crypto";
import { NotificationJob } from "@prisma/client";
import { prisma } from "@/lib/db";
import { renderIncidentOpeningEmail } from "./email-template";
import { createSmtpSender, EmailMessage, SendEmail } from "./smtp-gateway";

const LEASE_DURATION_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

export async function claimDueJobs(limit: number): Promise<NotificationJob[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Claim limit must be an integer between 1 and 100");
  }

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LEASE_DURATION_MS);

  return prisma.$transaction(
    (tx) =>
      tx.$queryRaw<NotificationJob[]>`
      WITH due_jobs AS (
        SELECT id
        FROM "NotificationJob"
        WHERE state = 'PENDING'
          AND "nextAttempt" <= ${now}
          AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
        ORDER BY "nextAttempt", "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "NotificationJob" AS job
      SET "lockedUntil" = ${lockedUntil}, "updatedAt" = ${now}
      FROM due_jobs
      WHERE job.id = due_jobs.id
      RETURNING job.*
    `,
  );
}

export async function deliverJob(
  jobId: string,
  sendEmail: SendEmail = createSmtpSender(),
): Promise<void> {
  const job = await prisma.notificationJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { incident: { include: { service: true } } },
  });

  if (
    job.state !== "PENDING" ||
    !job.lockedUntil ||
    job.lockedUntil <= new Date()
  ) {
    throw new Error("Notification job does not hold an active lease");
  }

  const windowStart = new Date(
    job.incident.openedAt.getTime() -
      job.incident.thresholdWindowSnapshot * 60 * 1000,
  );
  const [breakdown, firstReport] = await Promise.all([
    prisma.report.groupBy({
      by: ["issueType"],
      where: {
        serviceId: job.incident.serviceId,
        reportedAt: { gte: windowStart, lte: job.incident.openedAt },
      },
      _count: { _all: true },
      orderBy: { issueType: "asc" },
    }),
    prisma.report.aggregate({
      where: {
        serviceId: job.incident.serviceId,
        reportedAt: { gte: windowStart, lte: job.incident.openedAt },
      },
      _min: { reportedAt: true },
    }),
  ]);
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) throw new Error("APP_BASE_URL is required");

  const rendered = renderIncidentOpeningEmail({
    serviceName: job.incident.service.name,
    reportCount: job.incident.reportCountAtOpening,
    thresholdWindowMinutes: job.incident.thresholdWindowSnapshot,
    issueBreakdown: breakdown.map((item) => ({
      issueType: item.issueType,
      count: item._count._all,
    })),
    firstReportAt: firstReport._min.reportedAt ?? job.incident.openedAt,
    adminUrl: new URL(`/admin/incidents/${job.incidentId}`, baseUrl).toString(),
  });
  const message: EmailMessage = {
    to: job.recipientEmail,
    ...rendered,
  };

  try {
    await sendEmail(message);
  } catch (error) {
    await recordDeliveryFailure(jobId, job.attempts, error);
    throw error;
  }

  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      state: "SENT",
      attempts: { increment: 1 },
      deliveredAt: new Date(),
      lastError: null,
      lockedUntil: null,
    },
  });
}

async function recordDeliveryFailure(
  jobId: string,
  previousAttempts: number,
  error: unknown,
): Promise<void> {
  const attempts = previousAttempts + 1;
  const now = new Date();
  const baseDelay = Math.min(2 ** attempts * 30_000, MAX_RETRY_DELAY_MS);
  const jitteredDelay = Math.round(baseDelay * (randomInt(750, 1_251) / 1_000));

  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      state: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      attempts,
      lastError:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Delivery failed",
      nextAttempt: new Date(now.getTime() + jitteredDelay),
      lockedUntil: null,
    },
  });
}
