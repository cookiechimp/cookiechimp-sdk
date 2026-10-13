import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "./main";
import { CliError } from "./project";
import {
  apiBase,
  envName,
  type RemoteIo,
  runLink,
  runPull,
  upsertEnv,
} from "./remote";

const TOKEN = "cc_api_token_1234567890";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function project(files: Record<string, string> = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cc-remote-")));
  roots.push(root);
  const all = {
    "package.json": JSON.stringify({ dependencies: { next: "16.0.0" } }),
    "app/page.tsx": "",
    ...files,
  };
  for (const [file, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}
const site = (id: string, name = id) => ({
  id,
  name,
  allowed_domains: [`${id}.example`],
});
const bundle = (id = "acctA") => ({
  schema_version: 1,
  account_hashid: id,
  account: { allowed_domains: ["shop.example"] },
  cache_version: "a1b2c3",
  default_banner: "bnr1",
  banners: { bnr1: { hashid: "bnr1" } },
});
type Route = (url: URL, init: RequestInit | undefined) => Response;
function fakeFetch(route: Route) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    route(new URL(String(input)), init),
  );
}
const accountsRoute =
  (pages: object[][]): Route =>
  (url) => {
    if (url.pathname !== "/api/v1/accounts")
      return new Response("", { status: 404 });
    const page = Number(url.searchParams.get("page"));
    return Response.json({
      data: pages[page - 1] ?? [],
      pagination: { next: page < pages.length ? page + 1 : null },
    });
  };
const io = (patch: Partial<RemoteIo> = {}): RemoteIo => ({
  env: { COOKIECHIMP_API_TOKEN: TOKEN },
  fetch: fakeFetch(() => new Response("", { status: 500 })),
  ...patch,
});

describe("helpers", () => {
  it.each([
    ["next-app", [], "NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID"],
    ["next-pages", [], "NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID"],
    ["react", ["vite"], "VITE_COOKIECHIMP_PROJECT_ID"],
    ["vanilla", [], "COOKIECHIMP_PROJECT_ID"],
  ] as const)("names the env variable for %s", (framework, deps, name) => {
    expect(envName(framework, [...deps])).toBe(name);
  });

  it("only accepts https, or http on localhost", () => {
    expect(apiBase()).toBe("https://cookiechimp.com");
    expect(apiBase("http://127.0.0.1:4000/")).toBe("http://127.0.0.1:4000");
    for (const bad of [
      "http://cookiechimp.com",
      "https://u:p@cookiechimp.com",
      "https://cookiechimp.com/?x=1",
      "ftp://cookiechimp.com",
      "nope",
    ])
      expect(() => apiBase(bad)).toThrow(CliError);
  });

  it("upserts one key and keeps every other line", () => {
    const before =
      "# comment\nA=1\nexport NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID='old'\nB=2";
    const { content, previous } = upsertEnv(
      before,
      "NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID",
      "acctA",
    );
    expect(content).toBe(
      "# comment\nA=1\nNEXT_PUBLIC_COOKIECHIMP_PROJECT_ID=acctA\nB=2\n",
    );
    expect(previous).toBe("old");
    expect(upsertEnv("", "K", "v").content).toBe("K=v\n");
  });
});

describe("link", () => {
  it("lists sites with the bearer token, picks the only one and writes .env.local", async () => {
    const root = project({ ".env.local": "OTHER=1\n" });
    const fetch = fakeFetch(accountsRoute([[site("acctA", "Shop")]]));
    const result = await runLink({ cwd: root }, io({ fetch }));
    expect(result).toMatchObject({
      site: { id: "acctA", name: "Shop" },
      envKey: "NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID",
      changed: true,
    });
    expect(readFileSync(join(root, ".env.local"), "utf8")).toBe(
      "OTHER=1\nNEXT_PUBLIC_COOKIECHIMP_PROJECT_ID=acctA\n",
    );
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://cookiechimp.com/api/v1/accounts?visitor_stats=false&page=1",
    );
    expect(init).toMatchObject({
      redirect: "error",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("follows pagination and lets the user pick by number", async () => {
    const root = project();
    const prompt = vi.fn(async (_question: string) => "3");
    const result = await runLink(
      { cwd: root },
      io({
        fetch: fakeFetch(
          accountsRoute([[site("acctA"), site("acctB")], [site("acctC")]]),
        ),
        prompt,
      }),
    );
    expect(result.site.id).toBe("acctC");
    expect(prompt.mock.calls[0]?.[0]).toContain("3. acctC (acctC)");
  });

  it("refuses to guess between sites when not interactive", async () => {
    const root = project();
    await expect(
      runLink(
        { cwd: root },
        io({
          fetch: fakeFetch(accountsRoute([[site("acctA"), site("acctB")]])),
        }),
      ),
    ).rejects.toThrow(/Pass --project with one of: acctA, acctB/);
  });

  it("checks --project against the token's sites", async () => {
    const root = project();
    const fetch = fakeFetch(accountsRoute([[site("acctA"), site("acctB")]]));
    expect(
      (await runLink({ cwd: root, project: "acctB" }, io({ fetch }))).site.id,
    ).toBe("acctB");
    await expect(
      runLink({ cwd: root, project: "acctZ" }, io({ fetch })),
    ).rejects.toThrow(/not one of the sites/);
    await expect(
      runLink({ cwd: root, project: "../x" }, io({ fetch })),
    ).rejects.toThrow(/--project must be/);
  });

  it("needs a token, never takes it from argv, and never writes it", async () => {
    const root = project();
    await expect(runLink({ cwd: root }, io({ env: {} }))).rejects.toThrow(
      /COOKIECHIMP_API_TOKEN/,
    );
    const fetch = fakeFetch(accountsRoute([[site("acctA")]]));
    await runLink(
      { cwd: root, tokenStdin: true },
      io({ env: {}, stdin: async () => `${TOKEN}\n`, fetch }),
    );
    const env = readFileSync(join(root, ".env.local"), "utf8");
    expect(env).not.toContain(TOKEN);
    const err: string[] = [];
    expect(
      await main(["link", "--token", TOKEN, "--cwd", root], {
        out: () => {},
        err: (text) => err.push(text),
        cwd: () => root,
      }),
    ).toBe(2);
    expect(err.join("\n")).not.toContain(TOKEN);
  });

  it("explains a rejected token without echoing it or the response", async () => {
    const root = project();
    const fetch = fakeFetch(
      () => new Response(`secret ${TOKEN} \u001b[31m`, { status: 401 }),
    );
    const error = await runLink({ cwd: root }, io({ fetch })).catch(
      (caught: Error) => caught,
    );
    expect((error as Error).message).toMatch(/rejected \(401\)/);
    expect((error as Error).message).not.toContain(TOKEN);
    expect((error as Error).message).toContain("/api_tokens");
  });

  it("drops malformed sites and strips control characters from names", async () => {
    const root = project();
    const result = await runLink(
      { cwd: root },
      io({
        fetch: fakeFetch(
          accountsRoute([
            [
              { id: "../evil", name: "x" },
              { id: 5 },
              { id: "acctA", name: "Shop\u001b[2J\u202e" },
            ],
          ]),
        ),
      }),
    );
    expect(result.site).toMatchObject({ id: "acctA", name: "Shop[2J" });
  });

  it("refuses unexpected shapes, oversized bodies, redirects and timeouts", async () => {
    const root = project();
    const cases: Route[] = [
      () => Response.json({ nope: true }),
      () => new Response("x".repeat(1048577)),
      () => new Response("not json"),
    ];
    for (const route of cases)
      await expect(
        runLink({ cwd: root }, io({ fetch: fakeFetch(route) })),
      ).rejects.toThrow(CliError);
    await expect(
      runLink(
        { cwd: root },
        io({
          fetch: vi.fn(async () => {
            throw new TypeError("redirect mode is set to error");
          }),
        }),
      ),
    ).rejects.toThrow(/Could not reach https:\/\/cookiechimp.com/);
  });

  it("never writes the env file outside the project or through a symlink", async () => {
    const root = project();
    const outside = project();
    symlinkSync(join(outside, "target"), join(root, ".env.local"));
    const fetch = fakeFetch(accountsRoute([[site("acctA")]]));
    await expect(runLink({ cwd: root }, io({ fetch }))).rejects.toThrow(
      /symbolic link/,
    );
    await expect(
      runLink({ cwd: root, envFile: "../x.env" }, io({ fetch })),
    ).rejects.toThrow(/outside the project/);
  });

  it("dry run writes nothing", async () => {
    const root = project();
    const result = await runLink(
      { cwd: root, dryRun: true },
      io({ fetch: fakeFetch(accountsRoute([[site("acctA")]])) }),
    );
    expect(result.changed).toBe(true);
    expect(() => readFileSync(join(root, ".env.local"))).toThrow();
  });
});

describe("pull", () => {
  it("reads the linked id from .env.local and saves the public bundle without a token", async () => {
    const root = project({
      ".env.local": 'NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID="acctA"\n',
    });
    const fetch = fakeFetch((url) =>
      url.pathname === "/api/v1/mobile-sdk/offline/acctA"
        ? Response.json(bundle())
        : new Response("", { status: 404 }),
    );
    const result = await runPull({ cwd: root }, io({ fetch }));
    expect(result).toMatchObject({
      projectId: "acctA",
      out: "cookiechimp.config.json",
      banners: 1,
      cacheVersion: "a1b2c3",
    });
    expect(
      JSON.parse(readFileSync(join(root, "cookiechimp.config.json"), "utf8")),
    ).toEqual(bundle());
    const headers = (fetch.mock.calls[0]?.[1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });

  it("needs a linked project and validates the id", async () => {
    const root = project();
    await expect(runPull({ cwd: root }, io())).rejects.toThrow(
      /No project linked/,
    );
    await expect(runPull({ cwd: root, project: "a/b" }, io())).rejects.toThrow(
      /unexpected format/,
    );
  });

  it("rejects a bundle for another account, array banners, a bad shape or a newer schema", async () => {
    const root = project();
    for (const body of [
      bundle("acctX"),
      { ...bundle(), banners: [] },
      { schema_version: 1, account_hashid: "acctA" },
      [],
      { ...bundle(), schema_version: 2 },
    ]) {
      const error = await runPull(
        { cwd: root, project: "acctA" },
        io({ fetch: fakeFetch(() => Response.json(body)) }),
      ).catch((caught: Error) => caught);
      expect(error).toBeInstanceOf(CliError);
    }
  });

  it("reports a missing project as 404 and writes nothing", async () => {
    const root = project();
    await expect(
      runPull(
        { cwd: root, project: "acctA" },
        io({ fetch: fakeFetch(() => new Response("", { status: 404 })) }),
      ),
    ).rejects.toThrow(/Not found/);
    expect(() => readFileSync(join(root, "cookiechimp.config.json"))).toThrow();
  });

  it("refuses to write outside the project", async () => {
    const root = project();
    await expect(
      runPull(
        { cwd: root, project: "acctA", out: "../out.json" },
        io({ fetch: fakeFetch(() => Response.json(bundle())) }),
      ),
    ).rejects.toThrow(/outside the project/);
  });
});

describe("main", () => {
  it("runs link and pull through the injected io and prints JSON", async () => {
    const root = project();
    const out: string[] = [];
    const remote = io({
      fetch: fakeFetch((url) =>
        url.pathname.startsWith("/api/v1/accounts")
          ? Response.json({ data: [site("acctA")], pagination: {} })
          : Response.json(bundle()),
      ),
    });
    const ioMain = {
      out: (text: string) => out.push(text),
      err: (text: string) => out.push(text),
      cwd: () => root,
      remote: () => remote,
    };
    expect(await main(["link", "--json"], ioMain)).toBe(0);
    expect(JSON.parse(out.pop() as string)).toMatchObject({
      ok: true,
      site: { id: "acctA" },
    });
    expect(await main(["pull"], ioMain)).toBe(0);
    expect(out.pop()).toMatch(/Wrote cookiechimp.config.json for acctA/);
    expect(await main(["pull", "--api", "http://evil.example"], ioMain)).toBe(
      1,
    );
  });
});
