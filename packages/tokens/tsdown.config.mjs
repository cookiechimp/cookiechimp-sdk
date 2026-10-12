import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts", "src/tailwind.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
});
