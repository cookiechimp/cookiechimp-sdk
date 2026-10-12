/** Resolve a resource URL and allow only browser-fetchable HTTP protocols. */
export function isHttpUrl(source: string, base: string): boolean {
  try {
    const protocol = new URL(source, base).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
