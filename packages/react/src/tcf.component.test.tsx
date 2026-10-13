import { createConsent } from "@cookiechimp/core";
import {
  type Gvl,
  installTcf,
  type TcfController,
} from "@cookiechimp/core/tcf";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ConsentProvider, usePreferences } from "./index";
import { TcfVendorList } from "./tcf";
import { CookiePreferences } from "./ui";

const vendors: Gvl["vendors"] = {};
for (let id = 1; id <= 400; id++)
  vendors[id] = {
    id,
    name:
      id === 7
        ? "<img src=x onerror=alert(1)>"
        : `Vendor ${String(id).padStart(3, "0")}`,
    purposes: id % 5 === 0 ? [] : [1, 2],
    legIntPurposes: id % 3 === 0 ? [7] : [],
    specialFeatures: [],
  };
const gvl = {
  vendorListVersion: 150,
  tcfPolicyVersion: 5,
  purposes: {
    "1": { name: "Store and/or access information on a device" },
    "2": { name: "Use limited data to select advertising" },
    "7": { name: "Measure advertising performance" },
  },
  specialFeatures: { "1": { name: "Use precise geolocation data" } },
  vendors,
};

function Open() {
  const preferences = usePreferences();
  useEffect(() => preferences.show(), [preferences.show]);
  return null;
}

afterEach(() => {
  document.body.replaceChildren();
  delete (window as { __tcfapi?: unknown }).__tcfapi;
  localStorage.clear();
});

async function setup(options: { height?: number } = {}) {
  const runtime = createConsent({
    categories: { marketing: false },
    regulation: "gdpr",
  });
  const controller = installTcf(runtime, {
    cmpId: 300,
    gvl,
    storage: localStorage,
  });
  await controller.ready;
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ConsentProvider consent={runtime}>
        <Open />
        <CookiePreferences
          categories={[{ id: "marketing", label: "Marketing" }]}
        >
          <TcfVendorList
            controller={controller}
            height={options.height ?? 200}
            rowHeight={40}
          />
        </CookiePreferences>
      </ConsentProvider>,
    ),
  );
  return { runtime, controller, host, root };
}
const rows = (host: HTMLElement) => host.querySelectorAll(".cc-tcf__vendor");
const checkbox = (host: HTMLElement, label: string) =>
  host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
const button = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll(".cc-tcf button")].find(
    (b) => b.textContent === name,
  ) as HTMLButtonElement;
const tcData = (controller: TcfController) => controller.model;

describe("TcfVendorList", () => {
  it("renders inside CookiePreferences with purposes and a windowed vendor list", async () => {
    const { host } = await setup();
    expect(host.querySelector(".cc-preferences .cc-tcf")).not.toBeNull();
    expect(host.textContent).toContain(
      "Store and/or access information on a device",
    );
    expect(host.textContent).toContain("Vendors (400)");
    const visible = rows(host);
    // 200px viewport, 40px rows: 5 visible plus 4 overscan.
    expect(visible.length).toBe(9);
    expect(visible[0]?.getAttribute("aria-setsize")).toBe("400");
    expect(visible[0]?.getAttribute("aria-posinset")).toBe("1");
  });

  it("renders vendor names as text only", async () => {
    const { host } = await setup({ height: 400 });
    expect(host.querySelector(".cc-tcf img")).toBeNull();
    expect(host.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("windows rows while scrolling", async () => {
    const { host } = await setup();
    const viewport = host.querySelector(
      '[data-cc-part="tcf-vendors"]',
    ) as HTMLDivElement;
    await act(async () => {
      viewport.scrollTop = 4000;
      viewport.dispatchEvent(new Event("scroll"));
    });
    const positions = [...rows(host)].map((r) =>
      Number(r.getAttribute("aria-posinset")),
    );
    expect(Math.min(...positions)).toBe(97);
    expect(rows(host).length).toBeLessThanOrEqual(13);
  });

  it("filters vendors by search", async () => {
    const { host } = await setup();
    const search = host.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(search, "Vendor 012");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rows(host).length).toBe(1);
    expect(host.textContent).toContain("Vendor 012");
  });

  it("saves per-vendor consent and right to object, recording a decision", async () => {
    const { host, runtime, controller } = await setup();
    expect(runtime.needsDecision).toBe(true);
    await act(async () => checkbox(host, "Consent: Vendor 001").click());
    await act(async () =>
      checkbox(host, "Legitimate interest: Vendor 003").click(),
    );
    await act(async () => button(host, "Save choices").click());
    expect(runtime.needsDecision).toBe(false);
    expect([...(tcData(controller)?.vendorConsents ?? [])]).toEqual([1]);
    expect(tcData(controller)?.vendorLegitimateInterests.has(3)).toBe(false);
    expect(tcData(controller)?.vendorLegitimateInterests.has(6)).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      "Choices saved",
    );
    const stored = JSON.parse(localStorage.getItem("cc_tcf_choices") ?? "{}");
    expect(stored).toMatchObject({
      ts: runtime.get().ts,
      choices: { vendors: [1], vendorObjections: [3] },
    });
    expect(Object.keys(stored)).toEqual(["ts", "choices"]);
  });

  it("accept all and reject all apply to every disclosed vendor and purpose", async () => {
    const { host, controller } = await setup();
    await act(async () => button(host, "Accept all").click());
    expect(tcData(controller)?.vendorConsents.size).toBe(400);
    expect(tcData(controller)?.specialFeatureOptins.has(1)).toBe(true);
    await act(async () => button(host, "Reject all").click());
    expect(tcData(controller)?.vendorConsents.size).toBe(0);
    expect(tcData(controller)?.vendorLegitimateInterests.size).toBe(0);
    expect(tcData(controller)?.purposeLegitimateInterests.has(7)).toBe(false);
  });

  it("purpose consent and objection toggles reach the model", async () => {
    const { host, controller } = await setup();
    const purpose = [
      ...host.querySelectorAll(".cc-tcf__purposes .cc-tcf__purpose"),
    ][2] as HTMLElement;
    const [consent, li] = purpose.querySelectorAll("input");
    await act(async () => (consent as HTMLInputElement).click());
    await act(async () => (li as HTMLInputElement).click());
    await act(async () => button(host, "Save choices").click());
    expect(tcData(controller)?.purposeConsents.has(7)).toBe(true);
    expect(tcData(controller)?.purposeLegitimateInterests.has(7)).toBe(false);
  });

  it("restores saved choices on reload and drops them after a new decision", async () => {
    const first = await setup();
    await act(async () => checkbox(first.host, "Consent: Vendor 002").click());
    await act(async () => button(first.host, "Save choices").click());
    first.controller.stop();
    first.root.unmount();
    const consent = createConsent({
      categories: { marketing: false },
      regulation: "gdpr",
      initial: first.runtime.get(),
    });
    const again = installTcf(consent, {
      cmpId: 300,
      gvl,
      storage: localStorage,
    });
    await again.ready;
    expect([...(again.model?.vendorConsents ?? [])]).toEqual([2]);
    consent.rejectAll();
    expect(localStorage.getItem("cc_tcf_choices")).toBeNull();
    expect(again.model?.vendorConsents.has(2)).toBe(false);
  });

  it("renders nothing until the TCF model exists", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const controller = {
      gvl: null,
      model: null,
      setChoices: () => false,
      subscribe: () => () => {},
    };
    act(() =>
      createRoot(host).render(<TcfVendorList controller={controller} />),
    );
    expect(host.innerHTML).toBe("");
  });
});
