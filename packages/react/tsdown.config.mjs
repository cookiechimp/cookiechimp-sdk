import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.tsx",
    "src/headless.tsx",
    "src/banner.tsx",
    "src/ui.tsx",
    "src/tcf.tsx",
    "src/tcf-provider.tsx",
  ],
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
  banner: { js: '"use client";' },
  external: [
    "react",
    "react-dom",
    "@cookiechimp/core",
    "@cookiechimp/core/gate",
    "@cookiechimp/core/endpoint",
    "@cookiechimp/core/gpp",
    "@cookiechimp/core/tcf",
    "@cookiechimp/react",
  ],
});
