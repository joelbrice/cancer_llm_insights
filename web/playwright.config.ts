import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end + accessibility regression suite. Start the stack first (scripts/e2e/start-stack.sh) or point
 * E2E_BASE_URL at a running deployment. PW_CHROMIUM_PATH selects a preinstalled Chromium (optional).
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 120_000, // multi-page sweeps (12 pages × axe) under parallel load
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions: executablePath ? { executablePath } : {} } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, launchOptions: executablePath ? { executablePath } : {} } },
  ],
});
