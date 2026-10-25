import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const shim = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "react-native": shim("./src/test/react-native.tsx"),
      "@react-native-async-storage/async-storage": shim(
        "./src/test/async-storage.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
