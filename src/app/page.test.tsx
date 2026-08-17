import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("identifies the internal status dashboard", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Service status" })).toBeVisible();
    expect(screen.getByText("WTG Downdetector")).toBeVisible();
  });
});
