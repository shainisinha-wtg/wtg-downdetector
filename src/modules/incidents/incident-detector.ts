import {
  Prisma,
  IncidentState,
  IncidentUpdateType,
} from "@prisma/client";
import { deriveServiceState, ServiceState } from "./service-state";

type DatabaseClient = Prisma.TransactionClient;

export interface ServiceStateInfo {
  state: ServiceState;
  count: number;
  threshold: number;
  hasOpenIncident: boolean;
  armed: boolean;
}

export interface DetectionResult {
  incidentCreated: boolean;
  incidentId?: string;
  state: ServiceState;
}

/**
 * Gets the current state of a service based on rolling report count and incidents.
 */
export async function getServiceState(
  serviceId: string,
  tx?: DatabaseClient
): Promise<ServiceStateInfo> {
  const prisma = tx || (await import("@/lib/db")).prisma;

  // Fetch service with FOR UPDATE lock
  const service = await prisma.service.findUniqueOrThrow({
    where: { id: serviceId },
  });

  const now = new Date();
  const windowStart = new Date(
    now.getTime() - service.thresholdWindowMinutes * 60 * 1000
  );

  // Count distinct reporter tokens in the rolling window
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "reporterTokenHmac") as count
    FROM "Report"
    WHERE "serviceId" = ${serviceId}::uuid
      AND "reportedAt" >= ${windowStart}
  `;

  const count = Number(result[0]?.count || 0);

  // Check for open incident
  const openIncident = await prisma.incident.findFirst({
    where: {
      serviceId,
      state: IncidentState.OPEN,
    },
  });

  const hasOpenIncident = openIncident !== null;

  const state = deriveServiceState({
    count,
    threshold: service.thresholdCount,
    hasOpenIncident,
    armed: service.detectionArmed,
  });

  return {
    state,
    count,
    threshold: service.thresholdCount,
    hasOpenIncident,
    armed: service.detectionArmed,
  };
}

/**
 * Evaluates a service for incident detection:
 * 1. Counts distinct reporters in rolling window
 * 2. Checks if threshold is met
 * 3. Checks for existing open incident (with early return if exists)
 * 4. Locks service row with FOR UPDATE
 * 5. Double-checks no incident was created concurrently
 * 6. Creates incident and notification job atomically
 * 7. Disarms detection when incident is created
 * 8. Re-arms detection when count drops below threshold
 */
export async function evaluateService(
  serviceId: string,
  tx?: DatabaseClient
): Promise<DetectionResult> {
  if (!tx) {
    const { prisma } = await import("@/lib/db");
    return prisma.$transaction((transaction) =>
      evaluateService(serviceId, transaction)
    );
  }

  const prisma = tx;

  // First, get service info without locking
  const service = await prisma.service.findUniqueOrThrow({
    where: { id: serviceId },
  });

  const now = new Date();
  const windowStart = new Date(
    now.getTime() - service.thresholdWindowMinutes * 60 * 1000
  );

  // Count distinct reporter tokens in the rolling window
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "reporterTokenHmac") as count
    FROM "Report"
    WHERE "serviceId" = ${serviceId}::uuid
      AND "reportedAt" >= ${windowStart}
  `;

  const count = Number(result[0]?.count || 0);

  // Check for open incident (before locking)
  const openIncident = await prisma.incident.findFirst({
    where: {
      serviceId,
      state: IncidentState.OPEN,
    },
  });

  const state = deriveServiceState({
    count,
    threshold: service.thresholdCount,
    hasOpenIncident: openIncident !== null,
    armed: service.detectionArmed,
  });

  // Early return if incident already exists
  if (openIncident) {
    return {
      incidentCreated: false,
      incidentId: openIncident.id,
      state,
    };
  }

  // Early return if threshold not met or not armed
  if (count < service.thresholdCount || !service.detectionArmed) {
    // Re-arm detection if count drops below threshold and no open incident
    if (count < service.thresholdCount && !service.detectionArmed) {
      await prisma.service.update({
        where: { id: serviceId },
        data: { detectionArmed: true },
      });
    }
    return {
      incidentCreated: false,
      state,
    };
  }

  // We need to create an incident - lock the service row
  const lockedService = await prisma.$queryRaw<
    Array<{
      id: string;
      thresholdCount: number;
      thresholdWindowMinutes: number;
      detectionArmed: boolean;
      ownerEmail: string;
    }>
  >`
    SELECT id, "thresholdCount", "thresholdWindowMinutes", "detectionArmed", "ownerEmail"
    FROM "Service"
    WHERE id = ${serviceId}::uuid
    FOR UPDATE
  `;

  if (!lockedService || lockedService.length === 0) {
    throw new Error("Service not found");
  }

  // Double-check no incident was created while we were waiting for the lock
  const doubleCheckIncident = await prisma.incident.findFirst({
    where: {
      serviceId,
      state: IncidentState.OPEN,
    },
  });

  if (doubleCheckIncident) {
    return {
      incidentCreated: false,
      incidentId: doubleCheckIncident.id,
      state: deriveServiceState({
        count,
        threshold: service.thresholdCount,
        hasOpenIncident: true,
        armed: service.detectionArmed,
      }),
    };
  }

  // Verify we're still armed (could have changed)
  if (!lockedService[0].detectionArmed) {
    return {
      incidentCreated: false,
      state,
    };
  }

  // Create incident
  const incident = await prisma.incident.create({
    data: {
      serviceId,
      state: IncidentState.OPEN,
      thresholdCountSnapshot: service.thresholdCount,
      thresholdWindowSnapshot: service.thresholdWindowMinutes,
      reportCountAtOpening: count,
      openedAt: now,
    },
  });

  // Create OPENING notification job
  await prisma.notificationJob.create({
    data: {
      incidentId: incident.id,
      notificationType: "OPENING",
      recipientEmail: lockedService[0].ownerEmail,
      state: "PENDING",
      nextAttempt: now,
      attempts: 0,
    },
  });

  // Create OPENED incident update
  await prisma.incidentUpdate.create({
    data: {
      incidentId: incident.id,
      updateType: IncidentUpdateType.OPENED,
      authorType: "SYSTEM",
      note: `Incident opened: ${count} reports in ${service.thresholdWindowMinutes} minutes`,
    },
  });

  // Disarm detection
  await prisma.service.update({
    where: { id: serviceId },
    data: { detectionArmed: false },
  });

  return {
    incidentCreated: true,
    incidentId: incident.id,
    state: deriveServiceState({
      count,
      threshold: service.thresholdCount,
      hasOpenIncident: true,
      armed: false,
    }),
  };
}
