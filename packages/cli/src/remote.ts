import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CliError, detectProject, type Framework } from "./project";
import { safePath } from "./safe-write";

/**
 * `link` and `pull`: the only CLI commands that use the network. They live in
 * their own chunk so `init` and `doctor` never load network code.
 */

export const DEFAULT_API = "https://cookiechimp.com";
export const TOKEN_ENV = "COOKIECHIMP_API_TOKEN";
const ID = /^[\w-]{1,64}$/;
const TIMEOUT_MS = 15000;
const MAX_ACCOUNTS_BYTES = 1048576;
const MAX_BUNDLE_BYTES = 2097152;
const MAX_PAGES = 20;

export interface RemoteIo {
  env: Readonly<Record<string, string | undefined>>;
  /** Ask the user to pick; undefined when not interactive. */
  prompt?: (question: string) => Promise<string>;
  /** Read all of stdin, for --token-stdin. */
  stdin?: () => Promise<string>;
  fetch?: typeof fetch;
}

export interface Site {
  id: string;
  name: string;
  domains: string[];
}

/** The env variable a framework exposes to browser code. */
export function envName(framework: Framework, deps: string[] = []): string {
  if (framework === "next-app" || framework === "next-pages")
    return "NEXT_PUBLIC_COOKIECHIMP_PROJECT_ID";
  if (deps.includes("vite")) return "VITE_COOKIECHIMP_PROJECT_ID";
  return "COOKIECHIMP_PROJECT_ID";
}

/** https, or http on localhost (for local platform development and tests). */
export function apiBase(value = DEFAULT_API): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CliError(`--api must be a URL: ${clean(value)}`);
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(url.protocol === "https:" || (url.protocol === "http:" && local))
  )
    throw new CliError("--api must be an https URL (http only for localhost)");
  return url.href.replace(/\/$/, "");
}

/** Strip control characters and cap length before echoing remote text. */
const clean = (value: unknown, max = 120) =>
  String(value)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point.
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .slice(0, max);

async function request(
  io: RemoteIo,
  url: string,
  limit: number,
  token?: string,
): Promise<unknown> {
  const doFetch = io.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await doFetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Never forward the token to another host.
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    throw new CliError(`Could not reach ${new URL(url).origin}.`);
  }
  try {
    if (response.status === 401 || response.status === 403)
      throw new CliError(
        token
          ? `The API token was rejected (${response.status}). Create one at ${new URL(url).origin}/api_tokens and set ${TOKEN_ENV}.`
          : `Access denied (${response.status}).`,
      );
    if (response.status === 404)
      throw new CliError("Not found (404). Check the project id.");
    if (!response.ok)
      throw new CliError(`The request failed with HTTP ${response.status}.`);
    const declared = Number(response.headers.get("content-length"));
    if (declared > limit) throw new CliError("The response is too large.");
    const text = await response.text();
    if (text.length > limit) throw new CliError("The response is too large.");
    try {
      return JSON.parse(text);
    } catch {
      throw new CliError("The response is not valid JSON.");
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("The request did not complete.");
  } finally {
    clearTimeout(timer);
  }
}

async function readToken(io: RemoteIo, fromStdin: boolean): Promise<string> {
  const raw = fromStdin ? await io.stdin?.() : io.env[TOKEN_ENV];
  const token = raw?.trim();
  if (!token)
    throw new CliError(
      `Set ${TOKEN_ENV} to an API token from your CookieChimp dashboard (Settings, API tokens), or pipe it with --token-stdin. Tokens are never saved.`,
    );
  if (!/^[\x21-\x7e]{8,256}$/.test(token))
    throw new CliError("The API token has an unexpected format.");
  return token;
}

/** List the sites the token can see, following pagination. */
export async function listSites(
  io: RemoteIo,
  api: string,
  token: string,
): Promise<Site[]> {
  const sites: Site[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = (await request(
      io,
      `${api}/api/v1/accounts?visitor_stats=false&page=${page}`,
      MAX_ACCOUNTS_BYTES,
      token,
    )) as { data?: unknown; pagination?: { next?: unknown } } | null;
    if (!body || !Array.isArray(body.data))
      throw new CliError("Unexpected response from the accounts API.");
    for (const item of body.data as Record<string, unknown>[]) {
      if (typeof item?.id !== "string" || !ID.test(item.id)) continue;
      sites.push({
        id: item.id,
        name: clean(item.name ?? item.id, 80),
        domains: Array.isArray(item.allowed_domains)
          ? item.allowed_domains
              .filter((domain): domain is string => typeof domain === "string")
              .slice(0, 5)
              .map((domain) => clean(domain, 80))
          : [],
      });
    }
    if (!body.pagination?.next) break;
  }
  return sites;
}

/** Set KEY=value in a dotenv file, keeping every other line as it was. */
export function upsertEnv(content: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const lines = content === "" ? [] : content.replace(/\n$/, "").split("\n");
  const pattern = new RegExp(`^\\s*(export\\s+)?${key}\\s*=`);
  const index = lines.findIndex((existing) => pattern.test(existing));
  const previous =
    index >= 0
      ? (lines[index] as string)
          .replace(pattern, "")
          .trim()
          .replace(/^["']|["']$/g, "")
      : undefined;
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  return { content: `${lines.join("\n")}\n`, previous };
}

function readEnvValue(root: string, file: string, key: string) {
  const target = safePath(root, file);
  if (!existsSync(target)) return undefined;
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`);
  for (const line of readFileSync(target, "utf8").split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match) return (match[1] as string).trim().replace(/^["']|["']$/g, "");
  }
}

export interface LinkOptions {
  cwd: string;
  project?: string;
  api?: string;
  envFile?: string;
  tokenStdin?: boolean;
  dryRun?: boolean;
}

export interface LinkResult {
  site: Site;
  envFile: string;
  envKey: string;
  changed: boolean;
  previous?: string;
}

/** Pick a site with a dashboard API token and write its id to the env file. */
export async function runLink(
  options: LinkOptions,
  io: RemoteIo,
): Promise<LinkResult> {
  const project = detectProject(options.cwd);
  const api = apiBase(options.api);
  if (options.project !== undefined && !ID.test(options.project))
    throw new CliError(
      "--project must be a project id (letters, digits, _ and -).",
    );
  const token = await readToken(io, options.tokenStdin === true);
  const sites = await listSites(io, api, token);
  if (!sites.length)
    throw new CliError("This API token has no CookieChimp sites.");
  let site: Site | undefined;
  if (options.project) {
    site = sites.find((item) => item.id === options.project);
    if (!site)
      throw new CliError(
        `Project ${options.project} is not one of the sites this token can see.`,
      );
  } else if (sites.length === 1) site = sites[0];
  else if (io.prompt) {
    const menu = sites
      .map(
        (item, index) =>
          `  ${index + 1}. ${item.name} (${item.id})${item.domains.length ? ` ${item.domains.join(", ")}` : ""}`,
      )
      .join("\n");
    const answer = (await io.prompt(`Pick a site:\n${menu}\nNumber: `)).trim();
    site = sites[Number(answer) - 1];
    if (!/^\d+$/.test(answer) || !site) throw new CliError("No site picked.");
  } else
    throw new CliError(
      `This token can see ${sites.length} sites. Pass --project with one of: ${sites
        .map((item) => item.id)
        .join(", ")}`,
    );
  if (!site) throw new CliError("No site picked.");
  const envFile = options.envFile ?? ".env.local";
  const envKey = envName(project.framework, [
    ...Object.keys(project.pkg.dependencies ?? {}),
    ...Object.keys(project.pkg.devDependencies ?? {}),
  ]);
  const target = safePath(options.cwd, envFile);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  const { content, previous } = upsertEnv(current, envKey, site.id);
  const changed = content !== current;
  if (changed && !options.dryRun) writeFileSync(target, content);
  return { site, envFile, envKey, changed, previous };
}

export interface PullOptions {
  cwd: string;
  project?: string;
  api?: string;
  envFile?: string;
  out?: string;
  dryRun?: boolean;
}

export interface PullResult {
  projectId: string;
  out: string;
  bytes: number;
  banners: number;
  cacheVersion?: string;
}

/** Fetch the public dashboard config bundle and save it for offline builds. */
export async function runPull(
  options: PullOptions,
  io: RemoteIo,
): Promise<PullResult> {
  const project = detectProject(options.cwd);
  const api = apiBase(options.api);
  const envKey = envName(project.framework, [
    ...Object.keys(project.pkg.dependencies ?? {}),
    ...Object.keys(project.pkg.devDependencies ?? {}),
  ]);
  const projectId =
    options.project ??
    readEnvValue(options.cwd, options.envFile ?? ".env.local", envKey) ??
    io.env[envKey];
  if (!projectId)
    throw new CliError(
      `No project linked. Run \`cookiechimp link\` or pass --project.`,
    );
  if (!ID.test(projectId))
    throw new CliError("The project id has an unexpected format.");
  const bundle = (await request(
    io,
    `${api}/api/v1/mobile-sdk/offline/${projectId}`,
    MAX_BUNDLE_BYTES,
  )) as Record<string, unknown> | null;
  const banners = bundle?.banners;
  if (
    !bundle ||
    typeof bundle !== "object" ||
    Array.isArray(bundle) ||
    bundle.account_hashid !== projectId ||
    !banners ||
    typeof banners !== "object" ||
    Array.isArray(banners)
  )
    throw new CliError("The config bundle has an unexpected shape.");
  if (bundle.schema_version !== undefined && bundle.schema_version !== 1)
    throw new CliError(
      `Unsupported config schema_version ${clean(bundle.schema_version, 10)}. Update @cookiechimp/cli.`,
    );
  const out = options.out ?? "cookiechimp.config.json";
  const content = `${JSON.stringify(bundle, null, 2)}\n`;
  const target = safePath(options.cwd, out);
  if (!options.dryRun) writeFileSync(target, content);
  return {
    projectId,
    out,
    bytes: Buffer.byteLength(content),
    banners: Object.keys(banners).length,
    cacheVersion:
      typeof bundle.cache_version === "string"
        ? clean(bundle.cache_version, 64)
        : undefined,
  };
}
