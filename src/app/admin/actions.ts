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

// Validation schemas
const serviceFieldsSchema = z.object({
  category: z.string().trim().min(1).max(100),
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

    return { success: true };
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

    return { success: true };
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
