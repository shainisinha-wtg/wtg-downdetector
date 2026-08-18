import { IncidentState } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Custom error for invalid incident state transitions
 */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly currentState: IncidentState,
    public readonly attemptedAction: string
  ) {
    super(
      `Cannot ${attemptedAction} incident in ${currentState} state`
    );
    this.name = "InvalidTransitionError";
  }
}

/**
 * Atomically acknowledge an incident, create employee-visible update, and audit event
 */
export async function acknowledgeIncident(
  incidentId: string,
  actorId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error("Incident not found");
    }

    if (incident.state !== "OPEN") {
      throw new InvalidTransitionError(incident.state, "acknowledge");
    }

    // Update incident state
    await tx.incident.update({
      where: { id: incidentId },
      data: {
        state: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
      },
    });

    await tx.service.update({
      where: { id: incident.serviceId },
      data: { detectionArmed: true },
    });

    // Create employee-visible update
    await tx.incidentUpdate.create({
      data: {
        incidentId,
        updateType: "ACKNOWLEDGED",
        authorType: "ADMIN",
        authorId: actorId,
      },
    });

    // Create audit event
    await tx.auditEvent.create({
      data: {
        accountId: actorId,
        action: "INCIDENT_ACKNOWLEDGED",
        entityType: "INCIDENT",
        entityId: incidentId,
        metadata: {
          incidentId,
        },
      },
    });
  });
}

/**
 * Atomically publish an incident update with note and create audit event
 * Only allowed while incident is active (OPEN or ACKNOWLEDGED)
 */
export async function publishIncidentUpdate(
  incidentId: string,
  actorId: string,
  note: string
): Promise<void> {
  // Validate note length
  if (note.length < 1 || note.length > 1000) {
    throw new Error("Note must be between 1 and 1000 characters");
  }

  await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error("Incident not found");
    }

    if (incident.state === "RESOLVED") {
      throw new InvalidTransitionError(incident.state, "update");
    }

    // Create employee-visible update
    await tx.incidentUpdate.create({
      data: {
        incidentId,
        updateType: "NOTE",
        authorType: "ADMIN",
        authorId: actorId,
        note,
      },
    });

    // Create audit event
    await tx.auditEvent.create({
      data: {
        accountId: actorId,
        action: "INCIDENT_UPDATE_PUBLISHED",
        entityType: "INCIDENT",
        entityId: incidentId,
        metadata: {
          incidentId,
          noteLength: note.length,
        },
      },
    });
  });
}

/**
 * Atomically resolve an incident with final message, create update, and audit event
 * Only allowed for active incidents (OPEN or ACKNOWLEDGED)
 */
export async function resolveIncident(
  incidentId: string,
  actorId: string,
  finalMessage: string
): Promise<void> {
  // Validate final message
  if (!finalMessage || finalMessage.trim().length === 0) {
    throw new Error("Final message is required");
  }

  if (finalMessage.length < 1 || finalMessage.length > 1000) {
    throw new Error("Final message must be between 1 and 1000 characters");
  }

  await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error("Incident not found");
    }

    if (incident.state === "RESOLVED") {
      throw new InvalidTransitionError(incident.state, "resolve");
    }

    // Update incident state
    await tx.incident.update({
      where: { id: incidentId },
      data: {
        state: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    // Create final employee-visible update
    await tx.incidentUpdate.create({
      data: {
        incidentId,
        updateType: "RESOLVED",
        authorType: "ADMIN",
        authorId: actorId,
        note: finalMessage,
      },
    });

    // Create audit event
    await tx.auditEvent.create({
      data: {
        accountId: actorId,
        action: "INCIDENT_RESOLVED",
        entityType: "INCIDENT",
        entityId: incidentId,
        metadata: {
          incidentId,
          finalMessage,
        },
      },
    });
  });
}
