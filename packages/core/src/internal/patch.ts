export type PatchFactory = (
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;

interface Entry {
  original: PropertyDescriptor;
  layers: Map<symbol, PatchFactory>;
  installed: PropertyDescriptor;
}

const targets = new WeakMap<object, Map<PropertyKey, Entry>>();

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
    entry = { original, layers: new Map(), installed: original };
    entries.set(key, entry);
  }
  const id = Symbol();
  entry.layers.set(id, wrapperFactory);
  let descriptor = entry.original;
  for (const factory of entry.layers.values()) descriptor = factory(descriptor);
  Object.defineProperty(target, key, descriptor);
  entry.installed = descriptor;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry?.layers.delete(id);
    if (!entry || !entries) return;
    const current = Object.getOwnPropertyDescriptor(target, key);
    const stillInstalled =
      current?.configurable === entry.installed.configurable &&
      current?.enumerable === entry.installed.enumerable &&
      current?.writable === entry.installed.writable &&
      current?.value === entry.installed.value &&
      current?.get === entry.installed.get &&
      current?.set === entry.installed.set;
    if (!stillInstalled) {
      entries.delete(key);
      return;
    }
    if (entry.layers.size === 0) {
      Object.defineProperty(target, key, entry.original);
      entries.delete(key);
      return;
    }
    let next = entry.original;
    for (const factory of entry.layers.values()) next = factory(next);
    Object.defineProperty(target, key, next);
    entry.installed = next;
  };
}
