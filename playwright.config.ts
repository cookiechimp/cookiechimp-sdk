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
    // Never reuse a server: a leftover `next start` keeps serving an older
    // `.next` build after `test:e2e` rebuilds the fixture, so client chunks
    // stop matching and pages never hydrate (timeouts that look like flakes).
    // A busy port now fails loudly instead.
    reuseExistingServer: false,
    url: "http://127.0.0.1:3000",
  },
});
