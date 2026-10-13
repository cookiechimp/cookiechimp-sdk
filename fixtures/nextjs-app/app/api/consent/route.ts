// Example self-hosted consent record receiver for the e2e fixture.
// Stores records in memory, deduplicated by `id`, and records which request
// headers arrived so tests can check that no cookies were sent.
type Stored = {
  id: string;
  record: unknown;
  contentType: string | null;
  cookie: string | null;
  site: string | null;
};

// Keyed by the `run` query parameter so parallel tests never share state.
const runs = new Map<
  string,
  { store: Map<string, Stored>; failNext: number }
>();
const state = (request: Request) => {
  const run = new URL(request.url).searchParams.get("run") ?? "";
  let entry = runs.get(run);
  if (!entry) {
    entry = { store: new Map(), failNext: 0 };
    if (runs.size > 1000) runs.clear();
    runs.set(run, entry);
  }
  return entry;
};
const MAX_BODY = 65536;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { store, ...run } = state(request);
  if (run.failNext > 0) {
    state(request).failNext -= 1;
    return new Response("unavailable", { status: 503 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response("too large", { status: 413 });
  let payload: { schemaVersion?: unknown; records?: unknown };
  try {
    payload = JSON.parse(text);
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.records))
    return new Response("invalid payload", { status: 400 });
  const accepted: string[] = [];
  for (const record of payload.records.slice(0, 100)) {
    const id = (record as { id?: unknown })?.id;
    if (typeof id !== "string" || id.length > 200) continue;
    if (!store.has(id))
      store.set(id, {
        id,
        record,
        contentType: request.headers.get("content-type"),
        cookie: request.headers.get("cookie"),
        site: request.headers.get("x-site"),
      });
    accepted.push(id);
  }
  return Response.json({ accepted });
}

export async function GET(request: Request) {
  return Response.json({ records: [...state(request).store.values()] });
}

// Test control: reset the store, optionally failing the next N POSTs.
export async function DELETE(request: Request) {
  const entry = state(request);
  entry.store.clear();
  entry.failNext =
    Number(new URL(request.url).searchParams.get("fail") ?? 0) || 0;
  return new Response(null, { status: 204 });
}
