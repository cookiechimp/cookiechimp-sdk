import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx"],
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
  banner: { js: '"use client";' },
  external: ["react", "react-dom", "@cookiechimp/core"],
});
