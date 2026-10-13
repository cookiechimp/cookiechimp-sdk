// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createConsent } from "./index";
import { createSync } from "./sync";

const config = (version: string, label: string) => ({
  schemaVersion: 1,
  configVersion: version,
  categories: [{ id: "analytics", label }],
  services: [],
  copy: {},
  translations: {},
  regions: {},
  theme: {},
});

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

it("first render uses the localStorage cache, then updates after idle revalidation", async () => {
  vi.useFakeTimers();
  localStorage.setItem("cc_config:proj_1", "1");
  localStorage.setItem(
    "cc_config:proj_1:1",
    JSON.stringify(config("1", "Cached analytics")),
  );
  let release: (response: Response) => void = () => {};
  const fetch = vi.fn(() => new Promise<Response>((done) => (release = done)));
  const sync = createSync({
    projectId: "proj_1",
    publishableKey: "cc_pk_component1",
    defaults: { categories: ["analytics"] },
    fetch,
  });
  sync.subscribe(() => render(labels(sync)));
  render(labels(sync));
  expect(document.body.textContent).toBe("Cached analytics");
  expect(fetch).not.toHaveBeenCalled();

  const consent = createConsent(sync.get().config);
  expect(consent.has("analytics")).toBe(false);

  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledOnce();
  expect(document.body.textContent).toBe("Cached analytics");
  release(new Response(JSON.stringify(config("2", "Fresh analytics"))));
  await vi.runAllTimersAsync();
  expect(document.body.textContent).toBe("Fresh analytics");
  expect(localStorage.getItem("cc_config:proj_1")).toBe("2");
  expect(localStorage.getItem("cc_config:proj_1:1")).toBeNull();
});

it("offline revalidation keeps the page on the local config", async () => {
  const sync = createSync({
    projectId: "proj_1",
    publishableKey: "cc_pk_component1",
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

it("a hostile cached entry cannot inject markup fields or pollute prototypes", () => {
  localStorage.setItem("cc_config:proj_1", "1");
  localStorage.setItem(
    "cc_config:proj_1:1",
    '{"schemaVersion":1,"configVersion":"1","__proto__":{"isAdmin":true},"categories":[{"id":"analytics","label":"Ok","onclick":"alert(1)"}]}',
  );
  const sync = createSync({
    projectId: "proj_1",
    publishableKey: "cc_pk_component1",
    revalidate: false,
  });
  expect(sync.get().source).toBe("cache");
  expect(sync.get().dashboard?.categories).toEqual([
    { id: "analytics", label: "Ok" },
  ]);
  expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
});
