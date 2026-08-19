import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface MaintenanceWindowSummary {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  inProgress: boolean;
}

export interface MaintenanceWindowCreate {
  serviceId: string;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
}

export class InvalidMaintenanceWindowError extends Error {}

/**
 * Windows that have not ended yet (upcoming or currently running), newest first.
 */
export async function getUpcomingMaintenanceWindows(
  options: { includeDisabledServices?: boolean } = {},
  prismaClient: PrismaClient = prisma,
): Promise<MaintenanceWindowSummary[]> {
  const now = new Date();

  const windows = await prismaClient.maintenanceWindow.findMany({
    where: {
      canceledAt: null,
      endsAt: { gte: now },
      ...(options.includeDisabledServices
        ? {}
        : { service: { enabled: true } }),
    },
    orderBy: { startsAt: "asc" },
    include: { service: { select: { name: true, slug: true } } },
  });

  return windows.map((window) => ({
    id: window.id,
    serviceId: window.serviceId,
    serviceName: window.service.name,
    serviceSlug: window.service.slug,
    title: window.title,
    description: window.description,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    inProgress: window.startsAt <= now,
  }));
}

export async function scheduleMaintenanceWindow(
  input: MaintenanceWindowCreate,
  accountId: string,
): Promise<void> {
  if (input.endsAt <= input.startsAt) {
    throw new InvalidMaintenanceWindowError(
      "Maintenance window must end after it starts",
    );
  }

  await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, name: true },
    });

    if (!service) throw new InvalidMaintenanceWindowError("Service not found");

    const overlapping = await tx.maintenanceWindow.findFirst({
      where: {
        serviceId: input.serviceId,
        canceledAt: null,
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new InvalidMaintenanceWindowError(
        "This service already has a maintenance window overlapping that period",
      );
    }

    const created = await tx.maintenanceWindow.create({
      data: {
        serviceId: input.serviceId,
        title: input.title,
        description: input.description || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });

    await tx.auditEvent.create({
      data: {
        accountId,
        action: "MAINTENANCE_WINDOW_SCHEDULED",
        entityType: "MAINTENANCE_WINDOW",
        entityId: created.id,
        metadata: {
          after: {
            serviceId: created.serviceId,
            serviceName: service.name,
            title: created.title,
            startsAt: created.startsAt.toISOString(),
            endsAt: created.endsAt.toISOString(),
          },
        },
      },
    });
  });
}

export async function cancelMaintenanceWindow(
  windowId: string,
  accountId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const window = await tx.maintenanceWindow.findUnique({
      where: { id: windowId },
    });

    if (!window) {
      throw new InvalidMaintenanceWindowError("Maintenance window not found");
    }
    if (window.canceledAt) return;

    await tx.maintenanceWindow.update({
      where: { id: windowId },
      data: { canceledAt: new Date() },
    });

    await tx.auditEvent.create({
      data: {
        accountId,
        action: "MAINTENANCE_WINDOW_CANCELED",
        entityType: "MAINTENANCE_WINDOW",
        entityId: windowId,
        metadata: {
          before: {
            serviceId: window.serviceId,
            title: window.title,
            startsAt: window.startsAt.toISOString(),
            endsAt: window.endsAt.toISOString(),
          },
        },
      },
    });
  });
}
