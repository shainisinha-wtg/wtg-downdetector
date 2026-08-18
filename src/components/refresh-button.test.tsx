import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshButton } from "./refresh-button";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("RefreshButton", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it("refreshes the current route when clicked", async () => {
    const user = userEvent.setup();
    render(<RefreshButton label="Refresh service status" />);

    await user.click(screen.getByRole("button", { name: "Refresh service status" }));

    expect(refresh).toHaveBeenCalledOnce();
  });
});
