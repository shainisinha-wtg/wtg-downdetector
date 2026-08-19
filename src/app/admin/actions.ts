"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireAdmin, ADMIN_COOKIE_NAME } from "@/modules/auth/require-admin";
import { revokeSession } from "@/modules/auth/session";
import {
  createServiceConfiguration,
  retryFailedNotification,
  updateServiceConfiguration,
} from "@/modules/admin/owner-management";
import {
  acknowledgeIncident,
  publishIncidentUpdate,
  resolveIncident,
  InvalidTransitionError,
} from "@/modules/incidents/incident-management";
import {
  cancelMaintenanceWindow,
  scheduleMaintenanceWindow,
  InvalidMaintenanceWindowError,
} from "@/modules/maintenance/maintenance-windows";

// Validation schemas
const serviceFieldsSchema = z.object({
  category: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().max(2048),
  thresholdCount: z.number().int().min(1).max(1000),
  thresholdWindowMinutes: z.number().int().min(1).max(1440),
  ownerEmail: z.string().email(),
  issueTypes: z
    .array(z.enum(["UNAVAILABLE", "SLOW", "LOGIN", "CONNECTIVITY", "OTHER"]))
    .min(1),
  enabled: z.boolean(),
});

const createServiceSchema = serviceFieldsSchema.extend({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens",
    ),
});

const updateServiceSchema = z
  .object({
    serviceId: z.string().uuid(),
  })
  .and(serviceFieldsSchema);

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

const scheduleMaintenanceSchema = z
  .object({
    serviceId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "End time must be after start time",
  });

const cancelMaintenanceSchema = z.object({
  maintenanceWindowId: z.string().uuid(),
});

/**
 * Logout: revoke session and delete cookie
 */
export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (token) {
    try {
      await revokeSession(token);
    } catch {
      console.error("Session revocation failed during logout");
    }
  }

  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}

export async function createService(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = createServiceSchema.parse(data);
    await createServiceConfiguration(validated, admin.id);

    revalidatePath("/admin");
    revalidatePath("/admin/services");
    revalidatePath("/");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error:
          "Validation failed: " +
          error.errors.map((item) => item.message).join(", "),
      };
    }
    console.error("Service creation failed");
    return { error: "Failed to create service" };
  }

  redirect("/admin/services");
}

/**
 * Update service configuration
 */
export async function updateService(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = updateServiceSchema.parse(data);

    await updateServiceConfiguration(validated, admin.id);

    revalidatePath("/admin");
    revalidatePath("/admin/services");
    revalidatePath("/");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error:
          "Validation failed: " + error.errors.map((e) => e.message).join(", "),
      };
    }
    console.error("Service update failed");
    return { error: "Failed to update service" };
  }

  redirect("/admin/services");
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
    console.error("Acknowledge incident failed");
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
    await publishIncidentUpdate(validated.incidentId, admin.id, validated.note);

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
    console.error("Publish update failed");
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
      validated.finalMessage,
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
    console.error("Resolve incident failed");
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

    await retryFailedNotification(validated.jobId, admin.id);

    revalidatePath("/admin");
    revalidatePath("/admin/services");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Validation failed" };
    }
    console.error("Notification retry failed");
    return {
      error:
        error instanceof Error ? error.message : "Failed to retry notification",
    };
  }
}

/**
 * Schedule an upcoming maintenance window for a service
 */
export async function scheduleMaintenanceWindowAction(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = scheduleMaintenanceSchema.parse(data);

    await scheduleMaintenanceWindow(
      {
        serviceId: validated.serviceId,
        title: validated.title,
        description: validated.description,
        startsAt: new Date(validated.startsAt),
        endsAt: new Date(validated.endsAt),
      },
      admin.id,
    );

    revalidatePath("/admin/services");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    if (error instanceof InvalidMaintenanceWindowError) {
      return { error: error.message };
    }
    if (error instanceof z.ZodError) {
      return {
        error:
          "Validation failed: " +
          error.errors.map((item) => item.message).join(", "),
      };
    }
    console.error("Maintenance window scheduling failed");
    return { error: "Failed to schedule maintenance window" };
  }
}

/**
 * Cancel a scheduled maintenance window
 */
export async function cancelMaintenanceWindowAction(data: unknown) {
  const admin = await requireAdmin();

  try {
    const validated = cancelMaintenanceSchema.parse(data);

    await cancelMaintenanceWindow(validated.maintenanceWindowId, admin.id);

    revalidatePath("/admin/services");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    if (error instanceof InvalidMaintenanceWindowError) {
      return { error: error.message };
    }
    if (error instanceof z.ZodError) {
      return { error: "Validation failed" };
    }
    console.error("Maintenance window cancellation failed");
    return { error: "Failed to cancel maintenance window" };
  }
}
