import { expect, test } from "@playwright/test";
import { resetE2EState } from "./test-reset";

test.beforeEach(async () => {
  await resetE2EState("employee");
});

test("employee reports Jira and receives duplicate feedback", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Search services" }).fill("Jira");
  const jira = page.getByTestId("service-row-Jira");
  await expect(jira).toBeVisible();

  await jira.getByRole("button", { name: "Report a problem with Jira" }).click();
  await page.getByLabel("Issue type").selectOption("UNAVAILABLE");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByTestId("report-receipt")).toContainText(
    "Report submitted"
  );

  await page.getByTestId("report-dialog").click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId("report-dialog")).toBeHidden();
  await jira.getByRole("button", { name: "Report a problem with Jira" }).click();
  await page.getByLabel("Issue type").selectOption("UNAVAILABLE");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByTestId("error-message")).toContainText(
    "already reported this service recently"
  );
});
