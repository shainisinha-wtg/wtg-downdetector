import { beforeEach, describe, expect, it, vi } from "vitest";

const { notificationJob, report } = vi.hoisted(() => ({
  notificationJob: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  report: {
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { notificationJob, report },
}));

import { deliverJob } from "./job-repository";

describe("deliverJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "https://status.internal";
    notificationJob.findUniqueOrThrow.mockResolvedValue({
      id: "job-1",
      incidentId: "incident-1",
      recipientEmail: "owners@example.internal",
      state: "PENDING",
      attempts: 0,
      lockedUntil: new Date(Date.now() + 60_000),
      incident: {
        id: "incident-1",
        serviceId: "service-1",
        openedAt: new Date("2026-08-18T10:15:00.000Z"),
        thresholdWindowSnapshot: 10,
        reportCountAtOpening: 10,
        service: { name: "Jira" },
      },
    });
    report.groupBy.mockResolvedValue([]);
    report.aggregate.mockResolvedValue({
      _min: { reportedAt: new Date("2026-08-18T10:10:00.000Z") },
    });
  });

  it("does not reschedule when recording a successful send fails", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    notificationJob.update.mockRejectedValue(new Error("Database unavailable"));

    await expect(deliverJob("job-1", sendEmail)).rejects.toThrow(
      "Database unavailable",
    );

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(notificationJob.update).toHaveBeenCalledOnce();
  });
});
