// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createConsent } from "./index";
import { createSync } from "./sync";

const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/platform-offline-bundle.json"),
  "utf8",
);
const ACCOUNT = "acctREDACTED";
const bundle = (version: string, analytics: string) => {
  const value = JSON.parse(FIXTURE);
  value.cache_version = version;
  value.categories[1].translations.en.name = analytics;
  return JSON.stringify(value);
};

function render(labels: string[]) {
  document.body.innerHTML = labels.map((label) => `<li>${label}</li>`).join("");
}
const labels = (sync: ReturnType<typeof createSync>) =>
  sync
    .get()
    .config.categories.filter((category) => !category.required)
    .map((category) => category.label ?? category.id);

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

it("first render uses the cached platform bundle, then updates after idle revalidation", async () => {
  vi.useFakeTimers();
  localStorage.setItem(`cc_config:${ACCOUNT}`, "v1");
  localStorage.setItem(
    `cc_config:${ACCOUNT}:v1`,
    bundle("v1", "Cached analytics"),
  );
  let release: (response: Response) => void = () => {};
  const fetch = vi.fn(() => new Promise<Response>((done) => (release = done)));
  const sync = createSync({ projectId: ACCOUNT, fetch });
  sync.subscribe(() => render(labels(sync)));
  render(labels(sync));
  expect(document.body.textContent).toBe("Cached analyticsMarketing");
  expect(fetch).not.toHaveBeenCalled();

  // The default banner is opt_out, so optional categories default on where
  // no regulation overrides them.
  const consent = createConsent({
    ...sync.get().config,
    fallbackRegulation: "none",
  });
  expect(consent.get().categories.analytics).toBe(true);

  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledOnce();
  expect(document.body.textContent).toBe("Cached analyticsMarketing");
  release(new Response(bundle("v2", "Fresh analytics")));
  await vi.runAllTimersAsync();
  expect(document.body.textContent).toBe("Fresh analyticsMarketing");
  expect(localStorage.getItem(`cc_config:${ACCOUNT}`)).toBe("v2");
  expect(localStorage.getItem(`cc_config:${ACCOUNT}:v1`)).toBeNull();
});

it("a GDPR region gets the opt_in banner with German copy", () => {
  localStorage.setItem(`cc_config:${ACCOUNT}`, "a1b2c3d4");
  localStorage.setItem(`cc_config:${ACCOUNT}:a1b2c3d4`, FIXTURE);
  const sync = createSync({
    projectId: ACCOUNT,
    region: "DE",
    locale: "de-DE",
    revalidate: false,
  });
  render(labels(sync));
  expect(document.body.textContent).toBe("StatistikMarketing");
  expect(
    sync.get().config.categories.find((category) => category.id === "analytics")
      ?.default,
  ).toBe(false);
  expect(sync.get().dashboard?.copy).toMatchObject({
    consent_modal: { accept_btn: "Alle akzeptieren" },
  });
});

it("offline revalidation keeps the page on the local config", async () => {
  const sync = createSync({
    projectId: ACCOUNT,
    defaults: { categories: [{ id: "analytics", label: "Local analytics" }] },
    fetch: vi.fn(async () => {
      throw new TypeError("offline");
    }),
    revalidate: false,
  });
  sync.subscribe(() => render(labels(sync)));
  await sync.revalidate();
  expect(document.body.textContent).toBe("Local analytics");
  expect(sync.get().status).toBe("error");
});

it("a hostile cached entry is sanitised and pollutes nothing", () => {
  localStorage.setItem(`cc_config:${ACCOUNT}`, "a1b2c3d4");
  localStorage.setItem(
    `cc_config:${ACCOUNT}:a1b2c3d4`,
    FIXTURE.replace(
      '"version": 4,',
      '"version": 4, "__proto__": {"isAdmin": true},',
    ),
  );
  const sync = createSync({ projectId: ACCOUNT, revalidate: false });
  expect(sync.get().source).toBe("cache");
  expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
});
