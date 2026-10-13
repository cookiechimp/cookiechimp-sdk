import { defineConfig } from "@playwright/test";

const server = (filter: string, port: number) => ({
  command: `pnpm --filter ${filter} start`,
  // Never reuse a server: a leftover `next start` keeps serving an older
  // `.next` build after `test:e2e` rebuilds the fixture, so client chunks
  // stop matching and pages never hydrate (timeouts that look like flakes).
  // A busy port now fails loudly instead.
  reuseExistingServer: false,
  url: `http://127.0.0.1:${port}`,
});

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
    // Keep a trace for any failure (no retries are configured, so
    // "on-first-retry" never recorded one). CI uploads test-results/ on failure.
    trace: "retain-on-failure",
  },
  webServer: [
    server("@cookiechimp/fixture-nextjs", 3000),
    server("@cookiechimp/example-nextjs-app-router", 3101),
    server("@cookiechimp/example-nextjs-pages-router", 3102),
    server("@cookiechimp/docs", 3103),
    server("@cookiechimp/example-react-vite", 3104),
  ],
});
