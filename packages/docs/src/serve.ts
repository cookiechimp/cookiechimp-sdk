import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Minimal static server for local preview and e2e. Not for production hosting.
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

/** Map a request URL into root, or null when it is malformed or would leave root. */
export function resolveRequest(root: string, url: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url, "http://x").pathname);
  } catch {
    return null;
  }
  if (path.includes("\0")) return null;
  const file = resolve(
    root,
    `.${path.endsWith("/") ? `${path}index.html` : path}`,
  );
  return file.startsWith(root + sep) ? file : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  createServer(async (request, response) => {
    const file = resolveRequest(dist, request.url ?? "/");
    try {
      if (!file) throw new Error("outside dist");
      const body = await readFile(file);
      response
        .writeHead(200, {
          "content-type": types[extname(file)] ?? "application/octet-stream",
          "x-content-type-options": "nosniff",
        })
        .end(body);
    } catch {
      response
        .writeHead(404, { "content-type": "text/plain; charset=utf-8" })
        .end("Not found");
    }
  }).listen(Number(process.env.PORT ?? 3103), "127.0.0.1");
