"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IssueType } from "@prisma/client";
import { requireAdmin } from "@/modules/auth/require-admin";
import {
  acknowledgeIncident,
  publishIncidentUpdate,
  resolveIncident,
  InvalidTransitionError,
} from "@/modules/incidents/incident-management";
import { prisma } from "@/lib/db";

// Validation schemas
const updateServiceSchema = z.object({
  serviceId: z.string().uuid(),
  thresholdCount: z.number().int().min(1).max(1000),
  thresholdWindowMinutes: z.number().int().min(1).max(1440),
  ownerEmail: z.string().email(),
  issueTypes: z.array(z.enum(["UNAVAILABLE", "SLOW", "LOGIN", "CONNECTIVITY", "OTHER"])),
});

const acknowledgeIncidentSchema = z.object({
  incidentId: z.string().uuid(),
});

const publishUpdateSchema = z.object({
  incidentId: z.string().uuid(),
  note: z.string().min(1).max(1000),
});

const resolveIncidentSchema = z.object({
  incidentId: z.string().uuid(),
  finalMessage: z.string().min(1).max(1000),
});

const retryNotificationSchema = z.object({
  jobId: z.string().uuid(),
});

/**
 * Update service configuration
 */
export async function updateService(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = updateServiceSchema.parse(data);

    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: validated.serviceId },
        data: {
          thresholdCount: validated.thresholdCount,
          thresholdWindowMinutes: validated.thresholdWindowMinutes,
          ownerEmail: validated.ownerEmail,
          issueTypes: validated.issueTypes as IssueType[],
        },
      });

      await tx.auditEvent.create({
        data: {
          accountId: admin.id,
          action: "SERVICE_UPDATED",
          entityType: "SERVICE",
          entityId: validated.serviceId,
          metadata: {
            thresholdCount: validated.thresholdCount,
            thresholdWindowMinutes: validated.thresholdWindowMinutes,
            ownerEmail: validated.ownerEmail,
          },
        },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/services");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Validation failed: " + error.errors.map(e => e.message).join(", ") };
    }
    console.error("Update service error:", error);
    return { error: "Failed to update service" };
  }
}

/**
 * Acknowledge an incident
 */
export async function acknowledgeIncidentAction(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = acknowledgeIncidentSchema.parse(data);
    await acknowledgeIncident(validated.incidentId, admin.id);

    revalidatePath("/admin");
    revalidatePath("/admin/incidents/[id]", "page");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return { error: error.message };
    }
    if (error instanceof z.ZodError) {
      return { error: "Validation failed" };
    }
    console.error("Acknowledge incident error:", error);
    return { error: "Failed to acknowledge incident" };
  }
}

/**
 * Publish incident update
 */
export async function publishIncidentUpdateAction(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = publishUpdateSchema.parse(data);
    await publishIncidentUpdate(
      validated.incidentId,
      admin.id,
      validated.note
    );

    revalidatePath("/admin");
    revalidatePath("/admin/incidents/[id]", "page");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return { error: error.message };
    }
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    console.error("Publish update error:", error);
    return { error: "Failed to publish update" };
  }
}

/**
 * Resolve an incident
 */
export async function resolveIncidentAction(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = resolveIncidentSchema.parse(data);
    await resolveIncident(
      validated.incidentId,
      admin.id,
      validated.finalMessage
    );

    revalidatePath("/admin");
    revalidatePath("/admin/incidents/[id]", "page");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return { error: error.message };
    }
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    console.error("Resolve incident error:", error);
    return { error: "Failed to resolve incident" };
  }
}

/**
 * Retry a failed notification
 */
export async function retryNotification(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = retryNotificationSchema.parse(data);

    await prisma.$transaction(async (tx) => {
      const job = await tx.notificationJob.findUnique({
        where: { id: validated.jobId },
      });

      if (!job) {
        throw new Error("Notification job not found");
      }

      if (job.state !== "FAILED") {
        throw new Error("Can only retry failed notifications");
      }

      await tx.notificationJob.update({
        where: { id: validated.jobId },
        data: {
          state: "PENDING",
          nextAttempt: new Date(),
          lastError: null,
        },
      });

      await tx.auditEvent.create({
        data: {
          accountId: admin.id,
          action: "NOTIFICATION_RETRY",
          entityType: "NOTIFICATION_JOB",
          entityId: validated.jobId,
          metadata: {
            jobId: validated.jobId,
          },
        },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/services");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Validation failed" };
    }
    console.error("Retry notification error:", error);
    return { error: error instanceof Error ? error.message : "Failed to retry notification" };
  }
}
