import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  it("identifies the internal status dashboard", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { name: "Service status" })).toBeVisible();
    expect(screen.getByText("WTG Downdetector")).toBeVisible();
  });

  it("presents the dashboard as an internal service monitor", async () => {
    render(await HomePage());

    expect(screen.getByText("Internal service monitor")).toBeVisible();
    expect(screen.getByText("Live status")).toBeVisible();
  });
});
