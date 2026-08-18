import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";

process.env.E2E_RESET_SECRET ??= randomBytes(32).toString("hex");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NODE_ENV: "test",
      E2E_TEST_MODE: "1",
      E2E_RESET_SECRET: process.env.E2E_RESET_SECRET,
    },
  },
});
