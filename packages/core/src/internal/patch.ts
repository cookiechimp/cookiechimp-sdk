/* biome-ignore-all lint/style/noNonNullAssertion: registry entries are initialized before the release closure */
export type PatchFactory = (
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;

interface Entry {
  original: PropertyDescriptor;
  layers: Set<PatchFactory>;
  installed?: unknown;
}

const targets = new WeakMap<object, Map<PropertyKey, Entry>>();

function install(target: object, key: PropertyKey, entry: Entry): void {
  let descriptor = entry.original;
  for (const factory of entry.layers) descriptor = factory(descriptor);
  Object.defineProperty(target, key, descriptor);
  entry.installed = descriptor.value ?? descriptor.set;
}

/** Share reversible prototype patches between opt-in controllers. */
export function acquire(
  target: object,
  key: PropertyKey,
  wrapperFactory: PatchFactory,
): () => void {
  let entries = targets.get(target);
  if (!entries) {
    entries = new Map();
    targets.set(target, entries);
  }
  let entry = entries.get(key);
  if (!entry) {
    const original = Object.getOwnPropertyDescriptor(target, key);
    if (!original) return () => {};
    entry = { original, layers: new Set() };
    entries.set(key, entry);
  }
  entry.layers.add(wrapperFactory);
  install(target, key, entry);
  return () => {
    if (!entry!.layers.delete(wrapperFactory)) return;
    const current = Object.getOwnPropertyDescriptor(target, key);
    const stillInstalled =
      (current?.value ?? current?.set) === entry!.installed;
    if (!stillInstalled) entries!.delete(key);
    else if (entry!.layers.size) install(target, key, entry!);
    else {
      Object.defineProperty(target, key, entry!.original);
      entries!.delete(key);
    }
  };
}
