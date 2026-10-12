import { defineConfig } from "tsdown";

const shared = {
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    "typeof process": '"object"',
  },
};

export default defineConfig([
  { ...shared, entry: ["src/index.ts"] },
  {
    ...shared,
    entry: ["src/sync.ts", "src/match.ts", "src/regions.ts"],
    clean: false,
  },
]);
