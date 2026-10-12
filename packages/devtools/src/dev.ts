/**
 * True only when the build says it is not production. Builds without
 * `process` (script tags, CDN bundles, bundlers that do not define it) count
 * as production, so every devtools guard fails closed.
 */
export const isDev = (): boolean =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
