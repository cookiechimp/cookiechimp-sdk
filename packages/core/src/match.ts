import type { ConfigInput, NormalizedConfig } from "./config";
import { prepareMatcher } from "./internal/blocker";

export { prepareMatcher } from "./internal/blocker";

/** Prepare a matcher so request interception never recompiles its patterns. */
export interface ServiceMatch {
  url?: string;
  cookieName?: string;
  host?: string;
}

/** Find the first configured service matching any supplied signal. */
export function matchService(
  config: ConfigInput | NormalizedConfig,
  target: ServiceMatch,
): string | null {
  return prepareMatcher(config)(target);
}
