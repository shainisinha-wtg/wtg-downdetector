import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReportDialog } from "./report-dialog";
import userEvent from "@testing-library/user-event";

describe("ReportDialog - Accessibility", () => {
  const mockServices = [
    { id: "1", name: "VPN", issueTypes: ["CONNECTIVITY", "SLOW"] },
  ];

  it("should close dialog when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ReportDialog
        isOpen={true}
        onClose={onClose}
        services={mockServices}
        preselectedServiceId="1"
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should trap focus within the dialog and restore focus on close", async () => {
    const onClose = vi.fn();

    // Create a trigger button to track focus restoration
    const triggerButton = document.createElement("button");
    triggerButton.textContent = "Open Dialog";
    document.body.appendChild(triggerButton);
    triggerButton.focus();

    const { unmount } = render(
      <ReportDialog
        isOpen={true}
        onClose={onClose}
        services={mockServices}
        preselectedServiceId="1"
      />,
    );

    // Dialog should move focus inside (to close button)
    await waitFor(() => {
      const closeButtons = screen.getAllByLabelText(/close dialog/i);
      expect(closeButtons.length).toBeGreaterThan(0);
      // Focus should be on one of the close buttons
      expect(closeButtons.some((btn) => btn === document.activeElement)).toBe(
        true,
      );
    });

    // Unmount the dialog
    unmount();

    // Focus should be restored to the trigger
    await waitFor(() => {
      expect(document.activeElement).toBe(triggerButton);
    });

    document.body.removeChild(triggerButton);
  });

  it("should close dialog when clicking backdrop but not when clicking content", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = render(
      <div style={{ width: "500px", height: "500px" }}>
        <ReportDialog
          isOpen={true}
          onClose={onClose}
          services={mockServices}
          preselectedServiceId="1"
        />
      </div>,
    );

    // Get the dialog elements
    const dialogs = screen.getAllByRole("dialog");
    const dialogContent = dialogs[0];

    // Click content should not close (stopPropagation works)
    await user.click(dialogContent);
    expect(onClose).not.toHaveBeenCalled();

    // Now test that clicking the overlay directly calls onClose
    // We'll test this by directly invoking the click handler
    const overlays = container.querySelectorAll(".dialog-overlay");
    const overlay = overlays[0] as HTMLElement;

    // Simulate clicking the overlay backdrop by creating and dispatching a click event
    // that doesn't target the content
    const clickEvent = new MouseEvent("click", { bubbles: true });
    overlay.dispatchEvent(clickEvent);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
