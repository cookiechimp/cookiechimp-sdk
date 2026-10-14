import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.tsx",
    "src/server.tsx",
    "src/pages.tsx",
    "src/middleware.ts",
    "src/styles-route.tsx",
    // Its own entry so the server imports it from a plain module, not from
    // the shared "use client" chunk (where it would be a client reference).
    "src/messages.ts",
  ],
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
  banner: ({ fileName }) =>
    // `src-*` is the shared client chunk (the index entry's code) that
    // pages and server import; it uses hooks, so it is a client module too.
    fileName.startsWith("index.") ||
    fileName.startsWith("pages.") ||
    fileName.startsWith("src-")
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
    "@cookiechimp/core/gpp",
    "@cookiechimp/core/gpp-stub",
    "@cookiechimp/core/tcf-stub",
    "@cookiechimp/core/language",
    "@cookiechimp/core/regions",
    "@cookiechimp/core/sync",
    "@cookiechimp/react",
  ],
});
