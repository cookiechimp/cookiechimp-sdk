import { defineConfig } from "vitest/config";

export default defineConfig({
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
      "fixtures/**/*.component.test.ts",
      "packages/**/*.component.test.ts",
    ],
  },
});
