/**
 * The AsyncStorage methods the SDK uses. MMKV and other stores can adapt to it.
 * `getAllKeys` is required: the SDK's keys (consent, config cache, record
 * queue) are only known after the config loads, so they are found by prefix.
 */
export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet?(
    keys: readonly string[],
  ): Promise<readonly (readonly [string, string | null])[]>;
}

/** Synchronous storage in the shape `@cookiechimp/core` expects. */
export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MirroredStorage extends SyncStorage {
  /** Resolves when every write made so far has reached the backing store. */
  settled(): Promise<void>;
}

export const STORAGE_PREFIX = "@cookiechimp:";

/**
 * Load every SDK key from async storage into memory, then serve reads
 * synchronously and write through in order. Core reads consent, the config
 * cache and the record queue synchronously, so this runs once before the
 * runtime is created. Throws when the store cannot list its keys, since a
 * store that cannot be hydrated would forget every decision on each launch.
 */
export async function mirrorStorage(
  backing: AsyncKeyValueStorage,
): Promise<MirroredStorage> {
  if (typeof backing.getAllKeys !== "function")
    throw new TypeError("storage must implement getAllKeys()");
  const data = new Map<string, string>();
  try {
    const keys = (await backing.getAllKeys()).filter((key) =>
      key.startsWith(STORAGE_PREFIX),
    );
    const entries = backing.multiGet
      ? await backing.multiGet(keys)
      : await Promise.all(
          keys.map(async (key) => [key, await backing.getItem(key)] as const),
        );
    for (const [key, value] of entries)
      if (typeof value === "string")
        data.set(key.slice(STORAGE_PREFIX.length), value);
  } catch {
    // Storage is best effort: a failed read behaves like a first launch.
  }
  let queue = Promise.resolve();
  const write = (task: () => Promise<void>) => {
    queue = queue.then(task).catch(() => {});
  };
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      data.set(key, value);
      write(() => backing.setItem(STORAGE_PREFIX + key, value));
    },
    removeItem(key) {
      data.delete(key);
      write(() => backing.removeItem(STORAGE_PREFIX + key));
    },
    settled: () => queue,
  };
}

/** Non-persistent storage for tests and previews. */
export function memoryStorage(): AsyncKeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
}
