import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/require-admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ displayName: "Owner" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    incident: { findMany: vi.fn().mockResolvedValue([]) },
    notificationJob: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AdminDashboardPage", () => {
  it("renders a refresh control in the Owner Console header", async () => {
    const AdminDashboardPage = (await import("./page")).default;

    render(await AdminDashboardPage());

    expect(screen.getByRole("heading", { name: "Owner Console" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Refresh Owner Console" })
    ).toBeVisible();
  });
});
