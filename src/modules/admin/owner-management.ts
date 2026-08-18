import { IssueType } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface ServiceConfigurationUpdate {
  serviceId: string;
  thresholdCount: number;
  thresholdWindowMinutes: number;
  ownerEmail: string;
  issueTypes: IssueType[];
}

export async function updateServiceConfiguration(
  input: ServiceConfigurationUpdate,
  accountId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const oldService = await tx.service.findUnique({
      where: { id: input.serviceId },
    });

    if (!oldService) throw new Error("Service not found");

    await tx.service.update({
      where: { id: input.serviceId },
      data: {
        thresholdCount: input.thresholdCount,
        thresholdWindowMinutes: input.thresholdWindowMinutes,
        ownerEmail: input.ownerEmail,
        issueTypes: input.issueTypes,
      },
    });

    await tx.auditEvent.create({
      data: {
        accountId,
        action: "SERVICE_UPDATED",
        entityType: "SERVICE",
        entityId: input.serviceId,
        metadata: {
          before: {
            thresholdCount: oldService.thresholdCount,
            thresholdWindowMinutes: oldService.thresholdWindowMinutes,
            ownerEmail: oldService.ownerEmail,
            enabled: oldService.enabled,
            issueTypes: oldService.issueTypes,
          },
          after: {
            thresholdCount: input.thresholdCount,
            thresholdWindowMinutes: input.thresholdWindowMinutes,
            ownerEmail: input.ownerEmail,
            enabled: oldService.enabled,
            issueTypes: input.issueTypes,
          },
        },
      },
    });
  });
}

export async function retryFailedNotification(
  jobId: string,
  accountId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const job = await tx.notificationJob.findUnique({ where: { id: jobId } });

    if (!job) throw new Error("Notification job not found");
    if (job.state !== "FAILED") {
      throw new Error("Can only retry failed notifications");
    }

    await tx.notificationJob.update({
      where: { id: jobId },
      data: {
        state: "PENDING",
        attempts: 0,
        lastError: null,
        lockedUntil: null,
        nextAttempt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        accountId,
        action: "NOTIFICATION_RETRY",
        entityType: "NOTIFICATION_JOB",
        entityId: jobId,
        metadata: {
          before: { state: job.state, attempts: job.attempts },
          after: { state: "PENDING", attempts: 0 },
        },
      },
    });
  });
}