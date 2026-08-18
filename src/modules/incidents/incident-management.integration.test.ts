import { describe, it, expect, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import {
  acknowledgeIncident,
  publishIncidentUpdate,
  resolveIncident,
  InvalidTransitionError,
} from "./incident-management";
import { evaluateService } from "./incident-detector";

describe("Incident Management Integration", () => {
  let service: { id: string };
  let adminAccount: { id: string };

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

    service = await prisma.service.create({
      data: {
        name: "Test Service",
        slug: "test-service",
        category: "Developer Tools",
        ownerEmail: "owner@example.com",
        thresholdCount: 5,
        thresholdWindowMinutes: 10,
        issueTypes: ["UNAVAILABLE"],
        enabled: true,
        detectionArmed: true,
      },
    });

    adminAccount = await prisma.adminAccount.create({
      data: {
        username: "admin",
        passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
        displayName: "Admin User",
      },
    });
  });

  describe("Incident acknowledgement", () => {
    it("atomically acknowledges incident, creates update, and audit event", async () => {
      // Create an open incident
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "OPEN",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
        },
      });

      await acknowledgeIncident(incident.id, adminAccount.id);

      // Check incident state changed
      const updated = await prisma.incident.findUnique({
        where: { id: incident.id },
      });
      expect(updated?.state).toBe("ACKNOWLEDGED");
      expect(updated?.acknowledgedAt).toBeTruthy();

      // Check update created
      const updates = await prisma.incidentUpdate.findMany({
        where: { incidentId: incident.id },
      });
      expect(updates).toHaveLength(1);
      expect(updates[0].updateType).toBe("ACKNOWLEDGED");
      expect(updates[0].authorType).toBe("ADMIN");
      expect(updates[0].authorId).toBe(adminAccount.id);

      // Check audit event created
      const auditEvents = await prisma.auditEvent.findMany({
        where: { accountId: adminAccount.id },
      });
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0].action).toBe("INCIDENT_ACKNOWLEDGED");
      expect(auditEvents[0].entityType).toBe("INCIDENT");
      expect(auditEvents[0].entityId).toBe(incident.id);
    });

    it("rejects acknowledging already acknowledged incident", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "ACKNOWLEDGED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          acknowledgedAt: new Date(),
        },
      });

      await expect(
        acknowledgeIncident(incident.id, adminAccount.id)
      ).rejects.toThrow(InvalidTransitionError);
    });

    it("rejects acknowledging resolved incident", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "RESOLVED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          resolvedAt: new Date(),
        },
      });

      await expect(
        acknowledgeIncident(incident.id, adminAccount.id)
      ).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("Incident updates", () => {
    it("atomically publishes update and creates audit event", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "ACKNOWLEDGED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          acknowledgedAt: new Date(),
        },
      });

      const note = "Investigating the root cause";
      await publishIncidentUpdate(incident.id, adminAccount.id, note);

      // Check update created
      const updates = await prisma.incidentUpdate.findMany({
        where: {
          incidentId: incident.id,
          updateType: "NOTE",
        },
      });
      expect(updates).toHaveLength(1);
      expect(updates[0].note).toBe(note);
      expect(updates[0].authorType).toBe("ADMIN");
      expect(updates[0].authorId).toBe(adminAccount.id);

      // Check audit event created
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          accountId: adminAccount.id,
          action: "INCIDENT_UPDATE_PUBLISHED",
        },
      });
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0].entityId).toBe(incident.id);
    });

    it("rejects update on resolved incident", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "RESOLVED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          resolvedAt: new Date(),
        },
      });

      await expect(
        publishIncidentUpdate(incident.id, adminAccount.id, "Update")
      ).rejects.toThrow(InvalidTransitionError);
    });

    it("validates note length", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "OPEN",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
        },
      });

      const tooLongNote = "a".repeat(1001);
      await expect(
        publishIncidentUpdate(incident.id, adminAccount.id, tooLongNote)
      ).rejects.toThrow("Note must be between 1 and 1000 characters");
    });
  });

  describe("Incident resolution", () => {
    it("atomically resolves incident with final message, update, and audit event", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "ACKNOWLEDGED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          acknowledgedAt: new Date(),
        },
      });

      const finalMessage = "Issue has been resolved";
      await resolveIncident(incident.id, adminAccount.id, finalMessage);

      // Check incident resolved
      const updated = await prisma.incident.findUnique({
        where: { id: incident.id },
      });
      expect(updated?.state).toBe("RESOLVED");
      expect(updated?.resolvedAt).toBeTruthy();

      // Check final update created
      const updates = await prisma.incidentUpdate.findMany({
        where: {
          incidentId: incident.id,
          updateType: "RESOLVED",
        },
      });
      expect(updates).toHaveLength(1);
      expect(updates[0].note).toBe(finalMessage);

      // Check audit event created
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          accountId: adminAccount.id,
          action: "INCIDENT_RESOLVED",
        },
      });
      expect(auditEvents).toHaveLength(1);
    });

    it("requires non-empty final message", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "OPEN",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
        },
      });

      await expect(
        resolveIncident(incident.id, adminAccount.id, "")
      ).rejects.toThrow("Final message is required");
    });

    it("validates final message length", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "OPEN",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
        },
      });

      const tooLongMessage = "a".repeat(1001);
      await expect(
        resolveIncident(incident.id, adminAccount.id, tooLongMessage)
      ).rejects.toThrow("Final message must be between 1 and 1000 characters");
    });

    it("rejects resolving already resolved incident", async () => {
      const incident = await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "RESOLVED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          resolvedAt: new Date(),
        },
      });

      await expect(
        resolveIncident(incident.id, adminAccount.id, "Already resolved")
      ).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("Detection disarming after resolution", () => {
    it("keeps detector disarmed while counts remain elevated after resolution", async () => {
      // Create reports that cross threshold
      const reporterTokens = ["token1", "token2", "token3", "token4", "token5"];
      for (const token of reporterTokens) {
        await prisma.report.create({
          data: {
            serviceId: service.id,
            issueType: "UNAVAILABLE",
            reporterTokenHmac: token,
          },
        });
      }

      // Evaluate service - should create incident
      await evaluateService(service.id);

      let incidents = await prisma.incident.findMany({
        where: { serviceId: service.id },
      });
      expect(incidents).toHaveLength(1);

      let updatedService = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(updatedService?.detectionArmed).toBe(false);

      // Resolve the incident
      await resolveIncident(
        incidents[0].id,
        adminAccount.id,
        "Issue resolved"
      );

      // Evaluate again - detection should still be disarmed
      await evaluateService(service.id);

      incidents = await prisma.incident.findMany({
        where: { serviceId: service.id },
      });
      expect(incidents).toHaveLength(1); // No new incident

      updatedService = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(updatedService?.detectionArmed).toBe(false);
    });

    it("re-arms detection after counts fall below threshold", async () => {
      // Create reports that cross threshold
      const reporterTokens = ["token1", "token2", "token3", "token4", "token5"];
      for (const token of reporterTokens) {
        await prisma.report.create({
          data: {
            serviceId: service.id,
            issueType: "UNAVAILABLE",
            reporterTokenHmac: token,
            reportedAt: new Date(Date.now() - 11 * 60 * 1000), // 11 minutes ago, outside window
          },
        });
      }

      // Create incident manually
      await prisma.incident.create({
        data: {
          serviceId: service.id,
          state: "RESOLVED",
          thresholdCountSnapshot: 5,
          thresholdWindowSnapshot: 10,
          reportCountAtOpening: 5,
          resolvedAt: new Date(),
        },
      });

      await prisma.service.update({
        where: { id: service.id },
        data: { detectionArmed: false },
      });

      // Evaluate - reports are outside window, should re-arm
      await evaluateService(service.id);

      const updatedService = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(updatedService?.detectionArmed).toBe(true);
    });
  });
});
