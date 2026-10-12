import { defineConfig } from "vitest/config";

export default defineConfig({
  // The fixture tsconfig keeps Next.js "preserve" JSX, so transform JSX here for tests.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "happy-dom",
    onConsoleLog(log) {
      if (log.includes("Iframe page loading is disabled")) return false;
    },
    environmentOptions: {
      happyDOM: {
        settings: {
          disableIframePageLoading: true,
          disableJavaScriptEvaluation: true,
          disableJavaScriptFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    include: [
      "fixtures/**/*.component.test.{ts,tsx}",
      "packages/**/*.component.test.{ts,tsx}",
    ],
  },
});
