import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  format: ["esm", "cjs"],
  sourcemap: true,
  external: [
    "react",
    "react/jsx-runtime",
    "react-native",
    "@react-native-async-storage/async-storage",
    "@cookiechimp/core",
    "@cookiechimp/core/consent-log",
    "@cookiechimp/core/sync",
  ],
});
