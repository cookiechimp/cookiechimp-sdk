import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.tsx",
    "src/server.tsx",
    "src/pages.tsx",
    "src/middleware.ts",
    "src/styles-route.ts",
  ],
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
  banner: ({ fileName }) =>
    fileName.startsWith("index.") || fileName.startsWith("pages.")
      ? { js: '"use client";' }
      : undefined,
  external: [
    "server-only",
    "next",
    "next/headers",
    "next/server",
    "react",
    "react-dom",
    "@cookiechimp/core",
    "@cookiechimp/core/consent-mode",
    "@cookiechimp/core/language",
    "@cookiechimp/core/regions",
    "@cookiechimp/react",
  ],
});
