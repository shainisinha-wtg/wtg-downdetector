import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/require-admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    incident: {
      findUnique: vi.fn().mockResolvedValue({
        id: "incident-id",
        state: "OPEN",
        openedAt: new Date("2026-08-18T12:00:00Z"),
        acknowledgedAt: null,
        resolvedAt: null,
        reportCountAtOpening: 5,
        thresholdCountSnapshot: 10,
        thresholdWindowSnapshot: 10,
        service: { name: "Jira" },
        updates: [],
      }),
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("IncidentDetailPage", () => {
  it("renders the incident overview and preserves action form fields", async () => {
    const IncidentDetailPage = (await import("./page")).default;

    render(await IncidentDetailPage({ params: Promise.resolve({ id: "incident-id" }) }));

    expect(screen.getByText("Incident overview")).toBeVisible();
    expect(screen.getByText("Timeline")).toBeVisible();
    expect(screen.getByRole("button", { name: "Acknowledge Incident" })).toBeVisible();
    expect(screen.getByLabelText("Publish Update")).toHaveAttribute("name", "note");
    expect(screen.getByLabelText("Resolve Incident")).toHaveAttribute("name", "finalMessage");
  });
});
