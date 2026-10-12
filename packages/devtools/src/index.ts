import type { ConsentState, Region, Regulation } from "@cookiechimp/core";
import { regulationFor } from "@cookiechimp/core/regions";
import {
  clearSimulation,
  readSimulation,
  type Simulation,
  writeSimulation,
} from "./simulation";

export type { Simulation } from "./simulation";

/** The read-only part of a consent runtime the panel shows. */
export interface DevtoolsConsent {
  get(): ConsentState;
  subscribe(listener: (state: ConsentState) => void): () => void;
  readonly region?: Region | null;
  readonly regulation?: Regulation;
  readonly gpc?: boolean;
  readonly needsDecision?: boolean;
  readonly language?: string;
}

/** A blocked entry from `gateScripts`, `blockDynamic` or `blockNetwork`. */
export type BlockedEntry =
  | { url: string; kind: string; category?: string; service?: string }
  | {
      el: HTMLScriptElement | HTMLIFrameElement;
      category: string;
      service?: string;
    };

export interface DevtoolsOptions {
  consent: DevtoolsConsent;
  /** Controllers whose `blocked()` lists are shown (gate, dynamic, network). */
  blockers?: readonly { blocked(): readonly BlockedEntry[] }[];
  /** Connected-mode sync client; its pending records are shown as the queue. */
  sync?: { queue(): readonly unknown[] };
  /** Where the active config came from. Defaults to `"local"`. */
  configSource?: "local" | "dashboard";
  document?: Document;
  /** Nonce for the panel's style element under a strict CSP. */
  nonce?: string;
  /** Start with the panel open. */
  open?: boolean;
  /** Refresh blocked and queue lists every N ms while open; 0 disables. Defaults to 1000. */
  refreshMs?: number;
  /** Called after a simulation is saved or cleared. Defaults to `location.reload()`. */
  reload?: () => void;
  storage?: Storage;
  /** The panel is a development tool; set this to mount it in a production build. */
  allowProduction?: boolean;
}

export interface DevtoolsController {
  readonly element: HTMLElement | null;
  refresh(): void;
  open(): void;
  close(): void;
  unmount(): void;
}

const noop: DevtoolsController = {
  element: null,
  refresh() {},
  open() {},
  close() {},
  unmount() {},
};

const production = () =>
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

function invalid(message: string): DevtoolsController {
  const text = `CookieChimp devtools: ${message}`;
  if (!production()) throw new TypeError(text);
  console.warn(text);
  return noop;
}

const STYLE = `:host{all:initial}
.t,.p{position:fixed;right:16px;z-index:2147483647;font:12px/1.4 system-ui,sans-serif;color:#111;background:#fff;border:1px solid #ccc;border-radius:8px}
.t{bottom:16px;padding:6px 10px;cursor:pointer}
.p{bottom:56px;width:340px;max-height:70vh;overflow:auto;padding:10px;box-shadow:0 4px 16px #0003}
.p[hidden]{display:none}
h2{font-size:12px;margin:10px 0 4px}
dl{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin:0}
dt{color:#555}dd{margin:0;word-break:break-all}
ul{margin:0;padding-left:16px}li{word-break:break-all}
input[type=text]{width:48px}`;

const show = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? "none"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

const regionText = (region: Region | null | undefined) =>
  region
    ? region.region
      ? `${region.country}-${region.region}`
      : region.country
    : "none";

function entry(item: BlockedEntry) {
  if ("el" in item)
    return {
      kind: item.el.tagName.toLowerCase(),
      url:
        item.el.getAttribute("data-cc-src") ??
        item.el.getAttribute("src") ??
        "",
      category: item.category,
      service: item.service,
    };
  return item;
}

/**
 * Mount the floating devtools panel. It only reads state and never makes a
 * network request; every value is written as text, never parsed as markup.
 */
export function mountDevtools(options: DevtoolsOptions): DevtoolsController {
  const {
    consent,
    blockers = [],
    sync,
    configSource = "local",
    nonce,
    refreshMs = 1000,
  } = options ?? ({} as DevtoolsOptions);
  if (
    !consent ||
    typeof consent.get !== "function" ||
    typeof consent.subscribe !== "function"
  )
    return invalid("consent must provide get and subscribe");
  if (configSource !== "local" && configSource !== "dashboard")
    return invalid('configSource must be "local" or "dashboard"');
  if (!Number.isFinite(refreshMs) || refreshMs < 0)
    return invalid("refreshMs must be a non-negative finite number");
  if (
    !Array.isArray(blockers) ||
    blockers.some((b) => typeof b?.blocked !== "function")
  )
    return invalid("blockers must provide blocked()");
  if (sync !== undefined && typeof sync?.queue !== "function")
    return invalid("sync must provide queue()");
  if (production() && !options.allowProduction) {
    console.warn(
      "CookieChimp devtools is not mounted in production; pass allowProduction to override.",
    );
    return noop;
  }
  const doc = options.document ?? globalThis.document;
  if (!doc) return noop;
  const storage =
    options.storage ??
    (() => {
      try {
        return globalThis.sessionStorage;
      } catch {
        return undefined;
      }
    })();
  const reload = options.reload ?? (() => doc.defaultView?.location.reload());

  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
    attrs: Record<string, string> = {},
  ) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    for (const [name, value] of Object.entries(attrs))
      node.setAttribute(name, value);
    return node;
  };

  const host = el("div", undefined, { "data-cc-devtools": "" });
  const root = host.attachShadow({ mode: "open" });
  const style = el("style", STYLE, nonce ? { nonce } : {});
  const toggle = el("button", "CookieChimp", {
    type: "button",
    class: "t",
    "aria-expanded": "false",
    "aria-controls": "cc-devtools-panel",
  });
  const panel = el("div", undefined, {
    id: "cc-devtools-panel",
    class: "p",
    role: "dialog",
    "aria-label": "CookieChimp devtools",
  });
  panel.hidden = true;
  const body = el("div");

  // Simulation form, built once so typing is not lost on refresh.
  const sim = readSimulation(storage);
  const country = el("input", undefined, {
    type: "text",
    name: "country",
    maxlength: "2",
    "aria-label": "Simulated country",
    placeholder: "DE",
  });
  const sub = el("input", undefined, {
    type: "text",
    name: "region",
    maxlength: "3",
    "aria-label": "Simulated region",
    placeholder: "CA",
  });
  const gpc = el("input", undefined, {
    type: "checkbox",
    name: "gpc",
    "aria-label": "Simulate GPC",
  });
  country.value = sim?.region?.country ?? "";
  sub.value = sim?.region?.region ?? "";
  gpc.checked = sim?.gpc === true;
  const preview = el("p", "", { "data-cc-devtools-preview": "" });
  const error = el("p", "", { role: "alert" });
  const apply = el("button", "Apply and reload", { type: "button" });
  const clear = el("button", "Clear simulation", { type: "button" });
  const simulated = (): Simulation | null => {
    const code = country.value.trim().toUpperCase();
    const part = sub.value.trim().toUpperCase();
    const region = code
      ? part
        ? { country: code, region: part }
        : { country: code }
      : null;
    return { region, gpc: gpc.checked };
  };
  const updatePreview = () => {
    const next = simulated();
    preview.textContent = `Simulated regulation: ${regulationFor(next?.region ?? null)}`;
  };
  for (const input of [country, sub, gpc])
    input.addEventListener("input", updatePreview);
  apply.addEventListener("click", () => {
    const next = simulated();
    try {
      if (next && writeSimulation(next, storage)) {
        error.textContent = "";
        reload();
      } else
        error.textContent =
          "Use a 2-letter country and up to 3 letters or digits for the region.";
    } catch {
      error.textContent =
        "Use a 2-letter country and up to 3 letters or digits for the region.";
    }
  });
  clear.addEventListener("click", () => {
    clearSimulation(storage);
    reload();
  });
  const form = el("section", undefined, { "aria-label": "Simulate" });
  const gpcLabel = el("label", " GPC ");
  gpcLabel.append(gpc);
  form.append(
    el("h2", "Simulate region and GPC"),
    country,
    sub,
    gpcLabel,
    preview,
    error,
    apply,
    clear,
  );

  panel.append(body, form);
  root.append(style, toggle, panel);

  const list = (title: string, items: string[], empty: string) => {
    const section = el("section", undefined, { "aria-label": title });
    section.append(el("h2", `${title} (${items.length})`));
    if (!items.length) section.append(el("p", empty));
    else {
      const ul = el("ul");
      for (const item of items) ul.append(el("li", item));
      section.append(ul);
    }
    return section;
  };

  const refresh = () => {
    let state: ConsentState | undefined;
    try {
      state = consent.get();
    } catch {}
    const dl = el("dl");
    const rows: [string, unknown][] = [
      ["Consent id", state?.consentId],
      ["Action", state?.action],
      [
        "Decided",
        consent.needsDecision === undefined
          ? undefined
          : consent.needsDecision
            ? "no"
            : "yes",
      ],
      ["Region", regionText(consent.region)],
      ["Regulation", consent.regulation],
      [
        "GPC",
        consent.gpc === undefined ? undefined : consent.gpc ? "on" : "off",
      ],
      ["Language", consent.language],
      ["Config source", configSource],
      [
        "Simulation",
        sim ? `${regionText(sim.region)}${sim.gpc ? ", GPC on" : ""}` : "off",
      ],
    ];
    for (const [name, value] of rows)
      dl.append(el("dt", name), el("dd", show(value)));
    const categories = Object.entries(state?.categories ?? {}).map(
      ([name, on]) => `${name}: ${on ? "granted" : "denied"}`,
    );
    const blocked: string[] = [];
    for (const blocker of blockers) {
      try {
        for (const item of blocker.blocked()) {
          const { kind, url, category, service } = entry(item);
          blocked.push(
            `${kind} ${url}${category ? ` [${category}${service ? `/${service}` : ""}]` : ""}`,
          );
        }
      } catch {}
    }
    let queue: string[] = [];
    try {
      queue = (sync?.queue() ?? []).map((record) => show(record).slice(0, 300));
    } catch {}
    const state0 = el("section", undefined, { "aria-label": "State" });
    state0.append(el("h2", "State"), dl);
    body.replaceChildren(
      state0,
      list("Categories", categories, "No categories"),
      list("Blocked", blocked, "Nothing blocked"),
      list(
        "Sync queue",
        queue,
        sync ? "Queue empty" : "Not connected (local mode)",
      ),
    );
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    clearInterval(timer);
    timer = undefined;
    if (open) {
      refresh();
      if (refreshMs > 0) timer = setInterval(refresh, refreshMs);
    }
  };
  toggle.addEventListener("click", () => setOpen(panel.hidden === true));
  root.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  const unsubscribe = consent.subscribe(() => {
    if (!panel.hidden) refresh();
  });

  updatePreview();
  refresh();
  doc.body.append(host);
  if (options.open) setOpen(true);

  return {
    element: host,
    refresh,
    open: () => setOpen(true),
    close: () => setOpen(false),
    unmount() {
      clearInterval(timer);
      unsubscribe();
      host.remove();
    },
  };
}
