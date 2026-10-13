import { createConsent } from "@cookiechimp/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentProvider, useConsentActions } from "./index";

type Gpp = (
  command: string,
  callback?: (data: unknown, ok: boolean) => void,
  parameter?: unknown,
) => unknown;
const gpp = () => (window as unknown as { __gpp?: Gpp }).__gpp;
const ping = () => gpp()?.("ping") as Record<string, unknown> | undefined;

afterEach(() => {
  delete (window as unknown as { __gpp?: unknown }).__gpp;
  document.body.replaceChildren();
  // biome-ignore lint/suspicious/noDocumentCookie: tests reset the SDK cookie between cases.
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
  vi.restoreAllMocks();
});

const config = {
  categories: { advertising: false, marketing: false },
  region: { country: "US", region: "CA" },
  regulation: "ccpa" as const,
};

function Actions() {
  const actions = useConsentActions();
  return (
    <button type="button" onClick={() => actions.rejectAll()}>
      reject
    </button>
  );
}

async function mount(node: React.ReactNode) {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(node));
  await vi.waitFor(() => expect(ping()?.cmpStatus).toBe("loaded"), {
    timeout: 2000,
  });
  return { host, root };
}

describe("ConsentProvider gpp prop", () => {
  it("lazily installs __gpp for the region with config and tracks consent", async () => {
    const { host } = await mount(
      <ConsentProvider config={config} gpp>
        <Actions />
      </ConsentProvider>,
    );
    expect(ping()).toMatchObject({ applicableSections: [8] });
    await act(async () => host.querySelector("button")?.click());
    expect(gpp()?.("getField", undefined, "usca.SaleOptOut")).toBe(1);
  });

  it("passes options through and works with a consent runtime", async () => {
    const runtime = createConsent(config);
    await mount(
      <ConsentProvider
        consent={runtime}
        gpp={{
          approach: "national",
          values: { usnat: { SaleOptOutNotice: 1 } },
        }}
      >
        <span />
      </ConsentProvider>,
    );
    expect(ping()).toMatchObject({ applicableSections: [7] });
    expect(gpp()?.("getField", undefined, "usnat.SaleOptOutNotice")).toBe(1);
  });

  it("removes __gpp on unmount", async () => {
    const { root } = await mount(
      <ConsentProvider config={config} gpp>
        <span />
      </ConsentProvider>,
    );
    await act(async () => root.unmount());
    expect(gpp()).toBeUndefined();
  });

  it("never loads GPP without the prop", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    await act(async () =>
      createRoot(host).render(
        <ConsentProvider config={config}>
          <span />
        </ConsentProvider>,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gpp()).toBeUndefined();
  });
});
