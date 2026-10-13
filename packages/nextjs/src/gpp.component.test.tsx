import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ClientProvider } from "./index";
import { PagesConsentProvider } from "./pages";

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  delete (window as unknown as { __gpp?: unknown }).__gpp;
  document.body.innerHTML = "";
});

type Gpp = (command: string) => {
  cmpStatus: string;
  applicableSections: number[];
};
const ping = () => (window as unknown as { __gpp?: Gpp }).__gpp?.("ping");
const config = {
  categories: { marketing: false },
  region: { country: "US", region: "CO" },
  regulation: "ccpa" as const,
};

describe("Next.js providers forward gpp", () => {
  it.each([
    [
      "ClientProvider",
      <ClientProvider key="a" config={config} gpp>
        <span />
      </ClientProvider>,
    ],
    [
      "PagesConsentProvider",
      <PagesConsentProvider
        key="b"
        config={config}
        consent={null}
        region={{ country: "US", region: "CO" }}
        gpp
      >
        <span />
      </PagesConsentProvider>,
    ],
  ])("%s", async (_name, node) => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    await act(async () => root.render(node));
    await vi.waitFor(() => expect(ping()?.cmpStatus).toBe("loaded"), {
      timeout: 2000,
    });
    expect(ping()?.applicableSections).toEqual([10]);
    await act(async () => root.unmount());
  });
});
