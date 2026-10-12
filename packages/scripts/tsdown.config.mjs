import { defineConfig } from "tsdown";
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/ga4.ts",
    "src/gtm.ts",
    "src/google-ads.ts",
    "src/meta-pixel.ts",
    "src/clarity.ts",
    "src/posthog.ts",
    "src/segment.ts",
    "src/hotjar.ts",
    "src/linkedin.ts",
    "src/tiktok.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
  sourcemap: true,
});
