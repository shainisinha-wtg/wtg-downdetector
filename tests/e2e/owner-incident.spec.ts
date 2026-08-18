import { expect, test } from "@playwright/test";
import { resetE2EState } from "./test-reset";

test.beforeEach(async () => {
  await resetE2EState("owner");
});

test("owner manages an incident through resolution", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("e2e-owner");
  await page.getByLabel("Password").fill("e2e-owner-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Active Incidents" })).toBeVisible();
  await page.getByRole("link", { name: "Manage →", exact: true }).click();

  await page.getByRole("button", { name: "Acknowledge Incident" }).click();
  await expect(page.getByText("ACKNOWLEDGED", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Publish Update").fill("The service team is investigating.");
  await page.getByRole("button", { name: "Publish Update" }).click();
  await expect(page.getByText("The service team is investigating.")).toBeVisible();

  await page.getByLabel("Resolve Incident").fill("Jira access has been restored.");
  await page.getByRole("button", { name: "Resolve Incident" }).click();
  await expect(page.getByText("RESOLVED", { exact: true }).first()).toBeVisible();

  await page.goto("/services/jira");
  const resolvedIncidents = page
    .getByRole("heading", { name: "Recent resolved incidents" })
    .locator("..");
  await expect(resolvedIncidents).toBeVisible();
  await expect(
    resolvedIncidents.getByText("Jira access has been restored."),
  ).toBeVisible();
});
