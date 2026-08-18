import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./logout-button";

const { logoutMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({
  logout: logoutMock,
}));

describe("LogoutButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    logoutMock.mockReset();
  });

  it("does not report a Next redirect as a logout failure", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logoutMock.mockRejectedValueOnce({
      digest: "NEXT_REDIRECT;replace;/admin/login;307;",
    });

    render(<LogoutButton />);
    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledOnce();
    });

    expect(consoleError).not.toHaveBeenCalledWith("Logout failed");
  });
});
