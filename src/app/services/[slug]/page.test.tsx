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
      hourlyBuckets: Array(24).fill({
        hour: new Date().toISOString(),
        count: 0,
      }),
      issueBreakdown: [],
      latestOwnerUpdate: null,
      latestOwnerUpdateAt: null,
      activeIncident: null,
      recentResolvedIncidents: [],
    });

    const ServicePage = (await import("./page")).default;
    const params = Promise.resolve({ slug: "test-service" });

    render(await ServicePage({ params }));

    const reportButton = screen.getByRole("button", {
      name: /report a problem/i,
    });
    expect(reportButton).toBeDefined();
  });
});
