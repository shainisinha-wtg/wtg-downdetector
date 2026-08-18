import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/modules/services/service-queries", () => ({
  getServiceDetail: vi.fn(),
}));

describe("ServicePage", () => {
  it("should render a report button that opens the report dialog preselected to the service", async () => {
    const { getServiceDetail } = await import(
      "@/modules/services/service-queries"
    );
    vi.mocked(getServiceDetail).mockResolvedValue({
      id: "test-id",
      name: "Test Service",
      slug: "test-service",
      category: "Infrastructure",
      issueTypes: ["CONNECTIVITY", "SLOW"],
      currentState: "OPERATIONAL",
      reportCount: 5,
      threshold: 10,
      hourlyBuckets: Array.from({ length: 24 }, (_, index) => ({
        hour: new Date(Date.now() - index * 60 * 60 * 1000).toISOString(),
        count: 0,
      })),
      issueBreakdown: [],
      latestOwnerUpdate: null,
      latestOwnerUpdateAt: null,
      activeIncident: null,
      recentResolvedIncidents: [],
    });

    const ServicePage = (await import("./page")).default;
    const params = Promise.resolve({ slug: "test-service" });

    render(await ServicePage({ params }));

    expect(screen.getByText("WTG Downdetector")).toBeVisible();
    expect(screen.getByText("Service detail")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Test Service" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "24-hour report trend" })).toBeVisible();

    const reportButton = screen.getByRole("button", {
      name: /report a problem/i,
    });
    expect(reportButton).toBeDefined();
  });
});
