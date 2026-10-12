import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: [
      "fixtures/**/*.component.test.ts",
      "packages/**/*.component.test.ts",
    ],
  },
});
