import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import AdminLoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("AdminLoginPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("identifies the owner operations console", () => {
    render(<AdminLoginPage />);

    expect(screen.getByText("WTG Downdetector")).toBeVisible();
    expect(screen.getByText("Owner operations console")).toBeVisible();
    expect(screen.getByLabelText("Username")).toHaveAttribute("id", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("id", "password");
  });
});
