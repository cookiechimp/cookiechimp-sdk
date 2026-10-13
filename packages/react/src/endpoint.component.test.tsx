import { createConsent } from "@cookiechimp/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type ConsentEndpoint,
  ConsentProvider,
  useConsentActions,
} from "./index";

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  localStorage.clear();
  // biome-ignore lint/suspicious/noDocumentCookie: tests reset the SDK's cookie between cases.
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
});

const config = {
  categories: { analytics: false },
  regulation: "gdpr" as const,
};
type Init = RequestInit | undefined;

function Accept() {
  const actions = useConsentActions();
  return (
    <button type="button" onClick={() => actions.acceptAll()}>
      accept
    </button>
  );
}

async function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

describe("ConsentProvider endpoint", () => {
  it.each<[string, ConsentEndpoint, Record<string, string>]>([
    ["a same-origin path", "/api/consent", {}],
    [
      "a URL with static headers",
      { url: "/api/consent", headers: { "X-Site": "shop" } },
      { "X-Site": "shop" },
    ],
  ])(
    "POSTs each decision to %s without credentials",
    async (_name, endpoint, headers) => {
      const fetch = vi.fn(
        async (_url: RequestInfo | URL, _init: Init) => new Response(""),
      );
      vi.stubGlobal("fetch", fetch);
      const { container, root } = await mount(
        <ConsentProvider config={config} endpoint={endpoint}>
          <Accept />
        </ConsentProvider>,
      );
      await act(async () => container.querySelector("button")?.click());
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      const [url, init] = fetch.mock.calls[0] as [RequestInfo | URL, Init];
      expect(String(url)).toBe(`${location.origin}/api/consent`);
      expect(init).toMatchObject({
        method: "POST",
        credentials: "omit",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const body = JSON.parse(String(init?.body));
      expect(body.records).toHaveLength(1);
      expect(body.records[0].action).toBe("accept_all");
      await act(async () => root.unmount());
    },
  );

  it("buffers the GPC record made during render, before the endpoint module loads", async () => {
    const fetch = vi.fn(
      async (_url: RequestInfo | URL, _init: Init) => new Response(""),
    );
    vi.stubGlobal("fetch", fetch);
    const { root } = await mount(
      <ConsentProvider
        config={{
          categories: { marketing: false },
          regulation: "ccpa",
          gpc: true,
        }}
        endpoint="/api/consent"
      >
        <Accept />
      </ConsentProvider>,
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body.records[0].gpc).toBe(true);
    await act(async () => root.unmount());
  });

  it("keeps calling the user's onConsent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("")),
    );
    const onConsent = vi.fn();
    const { container, root } = await mount(
      <ConsentProvider
        config={{ ...config, onConsent }}
        endpoint="/api/consent"
      >
        <Accept />
      </ConsentProvider>,
    );
    await act(async () => container.querySelector("button")?.click());
    expect(onConsent).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it("fails closed on refused headers: no request, an error, consent still works", async () => {
    const fetch = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", fetch);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, root } = await mount(
      <ConsentProvider
        config={config}
        endpoint={{ url: "/api/consent", headers: { Cookie: "a=1" } }}
      >
        <Accept />
      </ConsentProvider>,
    );
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    await act(async () => container.querySelector("button")?.click());
    expect(document.cookie).toContain("cc_consent=");
    expect(fetch).not.toHaveBeenCalled();
    error.mockRestore();
    await act(async () => root.unmount());
  });

  it("warns and sends nothing when given a runtime instead of config", async () => {
    const fetch = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", fetch);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, root } = await mount(
      <ConsentProvider consent={createConsent(config)} endpoint="/api/consent">
        <Accept />
      </ConsentProvider>,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("endpoint needs config"),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(fetch).not.toHaveBeenCalled();
    warn.mockRestore();
    await act(async () => root.unmount());
  });

  it("stops sending after unmount", async () => {
    const fetch = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", fetch);
    const { root } = await mount(
      <ConsentProvider config={config} endpoint="/api/consent">
        <Accept />
      </ConsentProvider>,
    );
    await act(async () => root.unmount());
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetch).not.toHaveBeenCalled();
  });
});
