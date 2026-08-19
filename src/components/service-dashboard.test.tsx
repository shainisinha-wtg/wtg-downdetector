/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceDashboard } from "./service-dashboard";
import { ServiceListItem } from "@/modules/services/service-queries";

// Mock fetch
global.fetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockServices: ServiceListItem[] = [
  {
    id: "1",
    name: "Jira",
    slug: "jira",
    baseUrl: "https://jira.example.com",
    category: "Developer Tools",
    issueTypes: ["UNAVAILABLE", "SLOW", "LOGIN"],
    currentState: "OPERATIONAL",
    reportCount: 2,
    threshold: 10,
    hourlyBuckets: Array.from({ length: 24 }, (_, i) => ({
      hour: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
      count: i % 3,
    })),
    latestOwnerUpdate: null,
    latestOwnerUpdateAt: null,
    ownerUpdates: [],
  },
  {
    id: "2",
    name: "VPN",
    slug: "vpn",
    baseUrl: "https://vpn.example.com",
    category: "Connectivity",
    issueTypes: ["UNAVAILABLE", "SLOW", "CONNECTIVITY"],
    currentState: "REPORTS_RISING",
    reportCount: 5,
    threshold: 10,
    hourlyBuckets: Array.from({ length: 24 }, (_, i) => ({
      hour: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
      count: i % 5,
    })),
    latestOwnerUpdate: "Investigating connectivity issues",
    latestOwnerUpdateAt: new Date(),
    ownerUpdates: [
      {
        message: "Investigating connectivity issues",
        updatedAt: new Date(),
        updateType: "NOTE",
      },
    ],
  },
  {
    id: "3",
    name: "Bitbucket",
    slug: "bitbucket",
    baseUrl: "https://bitbucket.example.com",
    category: "Developer Tools",
    issueTypes: ["UNAVAILABLE", "SLOW", "LOGIN"],
    currentState: "OPERATIONAL",
    reportCount: 0,
    threshold: 10,
    hourlyBuckets: Array.from({ length: 24 }, () => ({
      hour: new Date().toISOString(),
      count: 0,
    })),
    latestOwnerUpdate: null,
    latestOwnerUpdateAt: null,
    ownerUpdates: [],
  },
];

describe("ServiceDashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("announces the number of monitored services", () => {
    render(<ServiceDashboard services={mockServices} />);

    expect(screen.getByText("3 services monitored")).toBeVisible();
  });

  it("renders a refresh control in the service status header", () => {
    render(<ServiceDashboard services={mockServices} />);

    expect(
      screen.getByRole("button", { name: "Refresh service status" })
    ).toBeVisible();
  });

  it("renders each service base URL below its name", () => {
    render(<ServiceDashboard services={mockServices} />);

    const jiraUrl = screen.getByRole("link", { name: "https://jira.example.com" });

    expect(jiraUrl).toHaveAttribute("href", "https://jira.example.com");
    expect(jiraUrl).toHaveAttribute("target", "_blank");
  });

  it("searches for 'jira' and finds one service", async () => {
    const user = userEvent.setup();
    render(<ServiceDashboard services={mockServices} />);

    const searchInput = screen.getByTestId("search-input");
    await user.type(searchInput, "jira");

    expect(screen.getByTestId("service-row-Jira")).toBeInTheDocument();
    expect(screen.queryByTestId("service-row-VPN")).not.toBeInTheDocument();
    expect(screen.queryByTestId("service-row-Bitbucket")).not.toBeInTheDocument();
  });

  it("filters by 'Connectivity' category", async () => {
    const user = userEvent.setup();
    render(<ServiceDashboard services={mockServices} />);

    const connectivityFilters = screen.getAllByTestId("filter-Connectivity");
    await user.click(connectivityFilters[0]);

    expect(screen.getByTestId("service-row-VPN")).toBeInTheDocument();
    expect(screen.queryByTestId("service-row-Jira")).not.toBeInTheDocument();
    expect(screen.queryByTestId("service-row-Bitbucket")).not.toBeInTheDocument();
  });

  it("opens report dialog from VPN row", async () => {
    const user = userEvent.setup();
    render(<ServiceDashboard services={mockServices} />);

    const vpnRow = screen.getByTestId("service-row-VPN");
    const reportButton = vpnRow.querySelector(".report-button") as HTMLButtonElement;

    await user.click(reportButton);

    expect(screen.getByTestId("report-dialog")).toBeInTheDocument();
    // Use heading role to be more specific
    expect(screen.getByRole("heading", { name: "Report a problem" })).toBeInTheDocument();
  });

  it("selects 'Slow' issue type and preserves form after server error", async () => {
    const user = userEvent.setup();

    // Mock failed API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, code: "RATE_LIMITED" }),
    });

    render(<ServiceDashboard services={mockServices} />);

    // Open dialog from VPN row
    const vpnRow = screen.getByTestId("service-row-VPN");
    const reportButton = vpnRow.querySelector(".report-button") as HTMLButtonElement;
    await user.click(reportButton);

    // Select service (should be preselected as VPN)
    const serviceSelect = screen.getByTestId("service-select") as HTMLSelectElement;
    expect(serviceSelect.value).toBe("2"); // VPN id

    // Select issue type
    const issueTypeSelect = screen.getByTestId("issue-type-select");
    await user.selectOptions(issueTypeSelect, "SLOW");

    // Add note
    const noteTextarea = screen.getByTestId("note-textarea");
    await user.type(noteTextarea, "Very slow connection");

    // Submit
    const submitButton = screen.getByTestId("submit-report");
    await user.click(submitButton);

    // Wait for error
    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });

    // Verify form values are preserved
    expect((issueTypeSelect as HTMLSelectElement).value).toBe("SLOW");
    expect((noteTextarea as HTMLTextAreaElement).value).toBe("Very slow connection");
  });

  it("renders receipt after successful submission", async () => {
    const user = userEvent.setup();

    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        nextAllowedAt: new Date().toISOString(),
        serviceState: "OPERATIONAL",
      }),
    });

    render(<ServiceDashboard services={mockServices} />);

    // Open dialog
    const reportButton = screen.getByTestId("global-report-button");
    await user.click(reportButton);

    // Fill form
    const serviceSelect = screen.getByTestId("service-select");
    await user.selectOptions(serviceSelect, "1"); // Jira

    const issueTypeSelect = screen.getByTestId("issue-type-select");
    await user.selectOptions(issueTypeSelect, "UNAVAILABLE");

    // Submit
    const submitButton = screen.getByTestId("submit-report");
    await user.click(submitButton);

    // Wait for receipt
    await waitFor(() => {
      expect(screen.getByTestId("report-receipt")).toBeInTheDocument();
      expect(screen.getByText("Report submitted")).toBeInTheDocument();
    });
  });

  it("increments a service report count after a successful report", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        nextAllowedAt: new Date().toISOString(),
        serviceState: "REPORTS_RISING",
      }),
    });

    render(<ServiceDashboard services={mockServices} />);

    const vpnRow = screen.getByTestId("service-row-VPN");
    await user.click(vpnRow.querySelector(".report-button") as HTMLButtonElement);
    await user.selectOptions(screen.getByTestId("issue-type-select"), "SLOW");
    await user.click(screen.getByTestId("submit-report"));

    await waitFor(() => {
      expect(screen.getByTestId("report-receipt")).toBeInTheDocument();
    });

    expect(vpnRow).toHaveTextContent("6 reports");
  });
});
