/** Resolve a resource URL and allow only browser-fetchable HTTP protocols. */
export function resolveHttp(source: string, base: string): URL | undefined {
  try {
    const url = new URL(source, base);
    if (url.protocol === "http:" || url.protocol === "https:") return url;
  } catch {}
}

export const isHttpUrl = (source: string, base: string): boolean =>
  !!resolveHttp(source, base);
