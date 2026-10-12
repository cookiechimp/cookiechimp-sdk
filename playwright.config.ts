import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm --filter @cookiechimp/fixture-nextjs start",
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:3000",
  },
});
