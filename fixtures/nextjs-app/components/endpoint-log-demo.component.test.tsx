import { ConsentProvider } from "@cookiechimp/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { consentConfig } from "../consent-config";
import { ConsentDemo } from "./consent-demo";
import { EndpointLogDemo } from "./endpoint-log-demo";

afterEach(() => {
  delete document.documentElement.dataset.ccDynamic;
  document.body.replaceChildren();
  localStorage.clear();
  // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
  vi.unstubAllGlobals();
});

async function renderAndAccept() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() =>
    root.render(
      <ConsentProvider config={consentConfig}>
        <ConsentDemo />
        <EndpointLogDemo />
      </ConsentProvider>,
    ),
  );
  const accept = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Accept all cookies",
  );
  expect(accept).toBeDefined();
  await act(async () => accept?.click());
  return root;
}

const status = () =>
  document.querySelector("[data-testid='endpoint-log']")?.textContent;

it("accepting POSTs one self-hosted record to the same-origin endpoint", async () => {
  const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    Response.json({ accepted: [] }),
  );
  vi.stubGlobal("fetch", fetch);
  const root = await renderAndAccept();
  expect(document.cookie).toContain("cc_consent=v1.");
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(String(url)).toBe(`${window.location.origin}/api/consent`);
  expect(init).toMatchObject({ credentials: "omit", keepalive: true });
  const { schemaVersion, records } = JSON.parse(String(init?.body));
  expect(schemaVersion).toBe(1);
  expect(Object.keys(records[0]).sort()).toEqual(
    [
      "action",
      "categories",
      "consentId",
      "gpc",
      "id",
      "language",
      "regulation",
      "services",
      "ts",
      "url",
    ].sort(),
  );
  expect(records[0]).toMatchObject({
    action: "accept_all",
    url: window.location.origin,
  });
  // An empty accepted list confirms nothing, so the record stays queued.
  await vi.waitFor(() => expect(status()).toBe("Queued: 1"));
  await act(() => root.unmount());
});

it("a failing endpoint never blocks the banner or loses the local consent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("down", { status: 503 })),
  );
  const root = await renderAndAccept();
  expect(document.cookie).toContain("cc_consent=v1.");
  expect(
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent === "Accept all cookies",
    ),
  ).toBe(false);
  await vi.waitFor(() => expect(status()).toBe("Queued: 1"));
  await act(() => root.unmount());
});
