import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { arch, cpus, platform, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { type Browser, chromium, type Page } from "@playwright/test";
import { type LaunchedChrome, launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { renderReport, type Sample, summarize } from "./model.ts";

const root = resolve(import.meta.dirname, "..");
const fixtures = ["baseline", "cookiechimp", "cookieyes", "vanilla"] as const;
type Fixture = (typeof fixtures)[number];
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split("=");
    return [key, rest.join("=") || "true"];
  }),
);
for (const key of args.keys())
  if (
    ![
      "--runs",
      "--warmups",
      "--output",
      "--no-lighthouse",
      "--fixtures",
      "--seed",
    ].includes(key as string)
  )
    throw new Error(`Unknown argument: ${key}`);
const integer = (key: string, fallback: number, min: number, max: number) => {
  const value = Number(args.get(key) ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${key}`);
  return value;
};
const runs = integer("--runs", 10, 1, 50);
const warmups = integer("--warmups", 1, 0, 5);
const seed = integer("--seed", 42, 1, 2 ** 31 - 1);
const useLighthouse = !args.has("--no-lighthouse");
const selected = (args.get("--fixtures")?.split(",") ?? fixtures) as Fixture[];
if (
  !selected.length ||
  new Set(selected).size !== selected.length ||
  selected.some((name) => !fixtures.includes(name))
)
  throw new Error("Invalid --fixtures");
const output = resolve(
  root,
  args.get("--output") ??
    `bench/results/${new Date().toISOString().replaceAll(":", "-")}.json`,
);
if (!output.endsWith(".json")) throw new Error("Output must end with .json");
const profile = {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  cpuSlowdownMultiplier: 4,
  latencyMs: 150,
  downloadKibps: 1600,
  uploadKibps: 750,
  observationMs: 3000,
};
const servers: ReturnType<typeof spawn>[] = [];
let chrome: LaunchedChrome | undefined;
let browser: Browser | undefined;
let interrupted = false;
const sleep = (ms: number) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const cleanup = async () => {
  await browser?.close().catch(() => {});
  chrome?.kill();
  for (const server of servers) server.kill("SIGTERM");
};
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    interrupted = true;
    void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });

async function port(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  const chosen = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((done) => server.close(() => done()));
  if (!chosen) throw new Error("No free local port");
  return chosen;
}

async function start(fixture: Fixture): Promise<string> {
  const directory = join(root, "bench/fixtures", fixture);
  const require = createRequire(join(directory, "package.json"));
  const chosen = await port();
  const child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(chosen),
    ],
    { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
  );
  servers.push(child);
  let log = "";
  for (const stream of [child.stdout, child.stderr])
    stream?.on("data", (chunk) => {
      log = (log + String(chunk)).slice(-20000);
    });
  let spawnError: Error | undefined;
  child.once("error", (error) => {
    spawnError = error;
  });
  const url = `http://127.0.0.1:${chosen}`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (spawnError || child.exitCode !== null)
      throw new Error(
        `Fixture ${fixture} failed: ${spawnError?.message ?? log}`,
      );
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok)
        return url;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Fixture ${fixture} did not become ready: ${log}`);
}

interface Observations {
  lcpMs: number | null;
  shifts: { start: number; value: number }[];
  interactionMs: number | null;
  bannerVisibleMs: number | null;
}
type MeasuredWindow = Window & { __bench?: Observations };
async function instrument(page: Page, fixture: Fixture) {
  await page.addInitScript(
    ({ hasBanner }) => {
      const state: Observations = {
        lcpMs: null,
        shifts: [],
        interactionMs: null,
        bannerVisibleMs: null,
      };
      (window as MeasuredWindow).__bench = state;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.lcpMs = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!shift.hadRecentInput)
            state.shifts.push({ start: shift.startTime, value: shift.value });
        }
      }).observe({ type: "layout-shift", buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes("event"))
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const event = entry as PerformanceEntry & {
              interactionId?: number;
            };
            if (event.interactionId)
              state.interactionMs = Math.max(
                state.interactionMs ?? 0,
                event.duration,
              );
          }
        }).observe({
          type: "event",
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
      if (hasBanner) {
        const visible = () => {
          const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
          if (dialog) {
            const box = dialog.getBoundingClientRect();
            const style = getComputedStyle(dialog);
            if (
              box.width > 0 &&
              box.height > 0 &&
              box.bottom > 0 &&
              box.top < innerHeight &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              Number(style.opacity) > 0
            ) {
              state.bannerVisibleMs = performance.now();
              return;
            }
          }
          requestAnimationFrame(visible);
        };
        requestAnimationFrame(visible);
      }
    },
    { hasBanner: fixture !== "baseline" },
  );
}

function cls(shifts: Observations["shifts"]): number {
  let max = 0,
    sum = 0,
    first = 0,
    last = -Infinity;
  for (const shift of shifts) {
    if (shift.start - last > 1000 || shift.start - first > 5000) {
      first = shift.start;
      sum = 0;
    }
    sum += shift.value;
    last = shift.start;
    max = Math.max(max, sum);
  }
  return max;
}

async function measure(
  fixture: Fixture,
  url: string,
  iteration: number,
): Promise<Sample> {
  const row: Sample = {
    fixture,
    iteration,
    status: "failed",
    jsGzipBytes: null,
    htmlGzipBytes: null,
    cssGzipBytes: null,
    lcpMs: null,
    cls: null,
    bannerVisibleMs: null,
    interactionMs: null,
    returningBannerVisible: null,
    lighthouseLcpMs: null,
    lighthouseCls: null,
    lighthouseTbtMs: null,
  };
  const context = await browser?.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  if (!context) throw new Error("Browser not connected");
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const bodies: Promise<{ type: string; bytes: number; error?: string }>[] = [];
  let collecting = true;
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (collecting && ["script", "stylesheet", "document"].includes(type))
      bodies.push(
        response
          .body()
          .then((body) => {
            if (!response.ok())
              throw new Error(
                `Asset status ${response.status()}: ${response.url()}`,
              );
            return { type, bytes: gzipSync(body, { level: 9 }).byteLength };
          })
          .catch((error) => ({ type, bytes: 0, error: String(error) })),
      );
  });
  const external: string[] = [];
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin !== url) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: profile.cpuSlowdownMultiplier,
    });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: profile.latencyMs,
      downloadThroughput: (profile.downloadKibps * 1024) / 8,
      uploadThroughput: (profile.uploadKibps * 1024) / 8,
    });
    await instrument(page, fixture);
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response?.ok()) throw new Error("Navigation failed");
    await page
      .locator('html[data-bench-hydrated="true"]')
      .waitFor({ timeout: 10000 });
    const remaining = await page.evaluate(
      (windowMs) => Math.max(0, windowMs - performance.now()),
      profile.observationMs,
    );
    await page.waitForTimeout(remaining);
    if (fixture !== "baseline")
      await page
        .locator('[role="dialog"]')
        .first()
        .waitFor({ state: "visible", timeout: 10000 });
    collecting = false;
    const snapshot = await page.evaluate(
      () => (window as MeasuredWindow).__bench,
    );
    if (
      !snapshot ||
      snapshot.lcpMs === null ||
      snapshot.lcpMs > profile.observationMs
    )
      throw new Error("LCP observation unavailable within the declared window");
    snapshot.shifts = snapshot.shifts.filter(
      (shift) => shift.start <= profile.observationMs,
    );
    row.nativeEvidence = { ...snapshot, observationMs: profile.observationMs };
    row.lcpMs = snapshot.lcpMs;
    row.cls = cls(snapshot.shifts);
    row.bannerVisibleMs = snapshot.bannerVisibleMs;
    if (
      fixture !== "baseline" &&
      (row.bannerVisibleMs === null ||
        row.bannerVisibleMs > profile.observationMs)
    )
      throw new Error(
        "Expected banner was not observed within the declared window",
      );
    const sizes = await Promise.all(bodies);
    row.resourceEvidence = sizes;
    if (sizes.some((asset) => asset.error))
      throw new Error("Initial resource response could not be measured");
    if (
      !sizes.some((asset) => asset.type === "script") ||
      !sizes.some((asset) => asset.type === "document")
    )
      throw new Error("Initial resource coverage incomplete");
    for (const [type, key] of [
      ["script", "jsGzipBytes"],
      ["document", "htmlGzipBytes"],
      ["stylesheet", "cssGzipBytes"],
    ] as const)
      row[key] = sizes
        .filter((asset) => asset.type === type)
        .reduce((sum, asset) => sum + asset.bytes, 0);
    if (fixture !== "baseline") {
      await page
        .getByRole("button", { name: /accept all/i })
        .first()
        .click();
      await page
        .locator('[role="dialog"]')
        .first()
        .waitFor({ state: "hidden", timeout: 10000 });
      if (!(await context.cookies()).length)
        throw new Error("Consent did not persist to a cookie");
    }
    await page.getByRole("button", { name: "Page action" }).click();
    await page.waitForFunction(
      () => document.querySelector("output")?.textContent === "1",
      undefined,
      { timeout: 3000 },
    );
    if ((await page.locator("output").textContent()) !== "1")
      throw new Error("Page stopped responding");
    await page.waitForTimeout(250);
    row.interactionMs = await page.evaluate(
      () => (window as MeasuredWindow).__bench?.interactionMs ?? null,
    );
    if (fixture !== "baseline") {
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('html[data-bench-hydrated="true"]').waitFor();
      // Visibility polling before interaction also catches hydration flashes.
      await page.waitForTimeout(300);
      row.returningBannerVisible = await page
        .locator('[role="dialog"]')
        .first()
        .isVisible();
      const returning = await page.evaluate(
        () => (window as MeasuredWindow).__bench?.bannerVisibleMs,
      );
      if (row.returningBannerVisible || returning !== null)
        throw new Error(
          "Consent was not retained or the returning banner flashed",
        );
    }
    if (errors.length || external.length)
      throw new Error(
        `Fixture errors: ${JSON.stringify({ errors, external })}`,
      );
    if (useLighthouse) {
      if (!chrome) throw new Error("Chrome unavailable");
      const result = await lighthouse(url, {
        port: chrome.port,
        onlyCategories: ["performance"],
        logLevel: "error",
        throttlingMethod: "devtools",
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: profile.width,
          height: profile.height,
          deviceScaleFactor: profile.deviceScaleFactor,
          disabled: false,
        },
        throttling: {
          rttMs: profile.latencyMs,
          throughputKbps: profile.downloadKibps,
          requestLatencyMs: profile.latencyMs,
          downloadThroughputKbps: profile.downloadKibps,
          uploadThroughputKbps: profile.uploadKibps,
          cpuSlowdownMultiplier: profile.cpuSlowdownMultiplier,
        },
      });
      if (!result || result.lhr.runtimeError)
        throw new Error(
          `Lighthouse failed: ${result?.lhr.runtimeError?.message}`,
        );
      const audits = result.lhr.audits;
      row.lighthouseEvidence = {
        lighthouseVersion: result.lhr.lighthouseVersion,
        userAgent: result.lhr.userAgent,
        fetchTime: result.lhr.fetchTime,
        configSettings: result.lhr.configSettings,
        audits: Object.fromEntries(
          [
            "largest-contentful-paint",
            "cumulative-layout-shift",
            "total-blocking-time",
          ].map((name) => [name, audits[name]]),
        ),
      };
      row.lighthouseLcpMs =
        audits["largest-contentful-paint"]?.numericValue ?? null;
      row.lighthouseCls =
        audits["cumulative-layout-shift"]?.numericValue ?? null;
      row.lighthouseTbtMs = audits["total-blocking-time"]?.numericValue ?? null;
      if (
        [row.lighthouseLcpMs, row.lighthouseCls, row.lighthouseTbtMs].some(
          (value) => value === null,
        )
      )
        throw new Error("Lighthouse metric unavailable");
    }
    row.status = "passed";
  } catch (error) {
    row.error = error instanceof Error ? error.message : String(error);
    // Settle response reads so a failed measurement cannot leak rejections.
    await Promise.allSettled(bodies);
  } finally {
    await context.close();
  }
  return row;
}

let random = seed;
const shuffle = () => {
  const order = [...selected];
  for (let index = order.length - 1; index > 0; index--) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    const target = (random >>> 0) % (index + 1);
    [order[index], order[target]] = [
      order[target] as Fixture,
      order[index] as Fixture,
    ];
  }
  return order;
};

try {
  chrome = await launch({
    chromePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromeFlags: [
      "--headless=new",
      "--no-first-run",
      "--disable-background-networking",
    ],
    logLevel: "silent",
    handleSIGINT: false,
  });
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  const urls = new Map<Fixture, string>();
  for (const fixture of selected) urls.set(fixture, await start(fixture));
  const manifest = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const metadata = {
    methodology: "cookiechimp-empty-nextjs-v1",
    recordedAt: new Date().toISOString(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    dirty: Boolean(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    ),
    lockfileSha256: createHash("sha256")
      .update(await readFile(join(root, "pnpm-lock.yaml")))
      .digest("hex"),
    browser: browser.version(),
    node: process.version,
    os: `${platform()} ${release()} ${arch()}`,
    cpu: cpus()[0]?.model,
    profile,
    runs,
    warmups,
    seed,
    lighthouse: useLighthouse ? manifest.devDependencies.lighthouse : null,
    fixtures: Object.fromEntries(
      await Promise.all(
        selected.map(async (fixture) => [
          fixture,
          JSON.parse(
            await readFile(
              join(root, "bench/fixtures", fixture, "package.json"),
              "utf8",
            ),
          ).dependencies,
        ]),
      ),
    ),
  };
  const samples: Sample[] = [];
  const excludedWarmups: Sample[] = [];
  for (let iteration = -warmups + 1; iteration <= runs; iteration++) {
    if (interrupted) break;
    for (const fixture of shuffle()) {
      const sample = await measure(
        fixture,
        urls.get(fixture) as string,
        iteration,
      );
      (iteration <= 0 ? excludedWarmups : samples).push(sample);
      console.log(
        `${iteration <= 0 ? "warmup" : `${iteration}/${runs}`} ${fixture}: ${sample.status}${sample.error ? ` (${sample.error})` : ""}`,
      );
    }
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify({ metadata, samples, excludedWarmups, summaries: summarize(samples, runs) }, null, 2)}\n`,
    { flag: "wx" },
  );
  await writeFile(
    output.replace(/\.json$/, ".md"),
    renderReport(samples, runs, metadata),
    { flag: "wx" },
  );
  console.log(`Raw evidence: ${output}`);
  if (
    samples.some((sample) => sample.status !== "passed") ||
    excludedWarmups.some((sample) => sample.status !== "passed")
  )
    process.exitCode = 1;
} finally {
  await cleanup();
}
