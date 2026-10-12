import {
  type ConfigInput,
  categoryRecords,
  type NormalizedConfig,
  normalizeConfig,
} from "./config";

function mergeById<T extends { id: string }>(
  ...sets: readonly (readonly T[] | undefined)[]
): T[] {
  const merged = new Map<string, T>();
  for (const set of sets)
    for (const item of set ?? [])
      merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()];
}

/** Merge local defaults, dashboard values and explicit code overrides. */
export function mergeConfig(
  defaults: ConfigInput,
  dashboard?: ConfigInput,
  override?: ConfigInput,
): NormalizedConfig {
  return normalizeConfig({
    categories: mergeById(
      categoryRecords(defaults.categories),
      categoryRecords(dashboard?.categories),
      categoryRecords(override?.categories),
    ),
    services: mergeById(
      defaults.services,
      dashboard?.services,
      override?.services,
    ),
  });
}

/** Return a compact category-version key independent of declaration order. */
export function categoriesHash(config: ConfigInput | NormalizedConfig): string {
  const categories = normalizeConfig(config)
    .categories.map(({ id, required, default: enabled, label, description }) =>
      JSON.stringify([id, required, enabled, label ?? "", description ?? ""]),
    )
    .sort();
  let hash = 0x811c9dc5;
  const text = categories.join("|");
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}
