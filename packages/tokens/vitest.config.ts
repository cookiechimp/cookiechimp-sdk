import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["src/**/*.component.test.ts"],
    include: ["src/**/*.test.ts"],
  },
});
