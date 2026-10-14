import { createConsent } from "@cookiechimp/core";
import type { TcfOptions } from "@cookiechimp/core/tcf";
import { ConsentProvider } from "@cookiechimp/react";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TcfProvider, type TcfProviderState } from "./tcf-provider";

const gvl = {
  vendorListVersion: 151,
  tcfPolicyVersion: 5,
  vendors: {
    "1": {
      id: 1,
      name: "Fixture vendor",
      purposes: [1, 2],
      legIntPurposes: [],
      specialFeatures: [],
    },
  },
};
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  // biome-ignore lint/suspicious/noDocumentCookie: reset the fixture's consent cookie.
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
  delete (window as typeof window & { __tcfapi?: unknown }).__tcfapi;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function setup(options: TcfOptions, enabled?: boolean, strict = false) {
  const runtime = createConsent({
    categories: { analytics: false },
    regulation: "gdpr",
  });
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  roots.push(root);
  const seen: TcfProviderState[] = [];
  const render = async (next = options, on = enabled) => {
    const content = (
      <ConsentProvider consent={runtime}>
        <TcfProvider enabled={on} options={next}>
          {(state) => {
            seen.push(state);
            return <span>{state.status}</span>;
          }}
        </TcfProvider>
      </ConsentProvider>
    );
    await act(async () =>
      root.render(strict ? <StrictMode>{content}</StrictMode> : content),
    );
  };
  return { runtime, host, root, seen, render };
}
const ready = async (host: HTMLElement) =>
  vi.waitFor(async () => {
    await act(async () => {});
    expect(host.textContent).toBe("ready");
  });

it("defaults disabled without loading the GVL or installing the CMP", async () => {
  const loader = vi.fn(async () => gvl);
  const { host, render } = setup({ cmpId: 123, gvl: loader });
  await render();
  expect(host.textContent).toBe("disabled");
  expect(loader).not.toHaveBeenCalled();
  expect((window as { __tcfapi?: unknown }).__tcfapi).toBeUndefined();
});
it("uses the existing runtime, survives StrictMode and follows decisions", async () => {
  const loader = vi.fn(async () => gvl);
  const { runtime, host, seen, render } = setup(
    { cmpId: 123, gvl: loader, purposes: { analytics: [1, 2] } },
    true,
    true,
  );
  await render();
  await ready(host);
  expect(loader).toHaveBeenCalledTimes(1);
  const controller = seen.at(-1)?.controller;
  expect(controller?.model?.vendorConsents.size).toBe(0);
  await act(async () => runtime.acceptAll());
  expect(controller?.model?.vendorConsents.has(1)).toBe(true);
  await act(async () => runtime.rejectAll());
  expect(controller?.model?.vendorConsents.size).toBe(0);
});
it("production without a registered CMP ID fails before loading any GVL", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const loader = vi.fn(async () => gvl);
  const { host, seen, render } = setup({ gvl: loader }, true);
  await render();
  await act(async () =>
    vi.waitFor(() => expect(host.textContent).toBe("error")),
  );
  expect(loader).not.toHaveBeenCalled();
  expect(seen.at(-1)?.controller).toBeNull();
});
it("invalid vendor data produces an error without a ready controller", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { host, seen, render } = setup(
    { cmpId: 123, gvl: async () => ({ vendors: {} }) },
    true,
  );
  await render();
  await act(async () =>
    vi.waitFor(() => expect(host.textContent).toBe("error")),
  );
  expect(seen.at(-1)?.controller).toBeNull();
});
it("drops old controllers immediately and ignores a stale pending GVL", async () => {
  let finish: (value: unknown) => void = () => {};
  const pending: TcfOptions = {
    cmpId: 123,
    gvl: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  const initial = { cmpId: 123, gvl: async () => gvl };
  const { host, seen, render, root } = setup(initial, true);
  await render();
  await ready(host);
  const previous = seen.at(-1)?.controller;
  await render(pending);
  expect(host.textContent).toBe("loading");
  expect(seen.at(-1)?.controller).toBeNull();
  await render(initial);
  await ready(host);
  const current = seen.at(-1)?.controller;
  expect(current).not.toBe(previous);
  await act(async () => finish(gvl));
  expect(seen.at(-1)?.controller).toBe(current);
  await render(initial, false);
  expect(host.textContent).toBe("disabled");
  expect((window as { __tcfapi?: unknown }).__tcfapi).toBeUndefined();
  const beforeEnable = seen.length;
  await render(initial, true);
  expect(seen[beforeEnable]?.controller).toBeNull();
  expect(seen[beforeEnable]?.status).toBe("loading");
  await ready(host);
  expect(seen.at(-1)?.controller).not.toBe(current);
  await act(async () => root.unmount());
  roots.splice(roots.indexOf(root), 1);
});
it("unmount cancels a pending vendor load and never reinstalls its API", async () => {
  let finish: (value: unknown) => void = () => {};
  const { host, render, root } = setup(
    {
      cmpId: 123,
      gvl: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    true,
  );
  await render();
  await vi.waitFor(() =>
    expect((window as { __tcfapi?: unknown }).__tcfapi).toBeTypeOf("function"),
  );
  await act(async () => root.unmount());
  roots.splice(roots.indexOf(root), 1);
  await act(async () => finish(gvl));
  expect(host.textContent).toBe("");
  expect((window as { __tcfapi?: unknown }).__tcfapi).toBeUndefined();
});
