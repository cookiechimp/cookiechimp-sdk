export interface RegistryMetadata {
  "dist.integrity"?: string;
  "dist.attestations"?: unknown;
}

/** npm 12 can wrap an exact-version, multi-field view result in a single-item array. */
export function parseRegistryMetadata(output: string): RegistryMetadata {
  const parsed: unknown = JSON.parse(output);
  const value =
    Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof (value as RegistryMetadata)["dist.integrity"] !== "string" ||
    !(value as RegistryMetadata)["dist.integrity"]
  )
    throw new Error("Invalid exact-version npm registry metadata");
  return value as RegistryMetadata;
}

/** npm can acknowledge a publish before its metadata and provenance are visible. */
export async function verifyRegistryPublication(
  entry: { name: string; version: string; integrity: string },
  read: () => RegistryMetadata,
  {
    attempts = 60,
    intervalMs = 5000,
    timeoutMs = 300000,
    wait = (milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
): Promise<RegistryMetadata> {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (Date.now() >= deadline) break;
    let published: RegistryMetadata | undefined;
    try {
      published = read();
    } catch (error) {
      const stderr = String((error as { stderr?: unknown })?.stderr ?? "");
      if (!/\bE404\b/.test(stderr)) throw error;
    }
    if (published?.["dist.integrity"]) {
      if (published["dist.integrity"] !== entry.integrity)
        throw new Error(`Published integrity differs: ${entry.name}`);
      if (published["dist.attestations"]) return published;
    }
    const remaining = deadline - Date.now();
    if (attempt < attempts && remaining > 0) {
      console.log(
        `Waiting for npm metadata and provenance: ${entry.name}@${entry.version} (${attempt}/${attempts})`,
      );
      await wait(Math.min(intervalMs, remaining));
    }
  }
  throw new Error(
    `Timed out verifying published integrity and provenance: ${entry.name}@${entry.version}`,
  );
}
