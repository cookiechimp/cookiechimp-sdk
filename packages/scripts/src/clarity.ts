import type { ScriptPreset } from "./index";
import { encodeId, validateId } from "./shared";
import { callQueue, vendor } from "./vendor";
export interface ClarityOptions {
  projectId: string;
  category?: string;
  nonce?: string;
}
export function clarity({
  projectId,
  category = "analytics",
  nonce,
}: ClarityOptions): ScriptPreset {
  validateId("Clarity project", projectId, /^[a-z0-9]{10}$/);
  return vendor(
    "clarity",
    category,
    `https://www.clarity.ms/tag/${encodeId(projectId)}`,
    ["https://www.clarity.ms/tag/*"],
    ["clarity.ms", "*.clarity.ms"],
    "clarity",
    (host) => callQueue(host, "clarity"),
    nonce,
  );
}
