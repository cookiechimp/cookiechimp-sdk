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
vendors[1] = {
  ...(vendors[1] as NonNullable<(typeof vendors)[1]>),
  legIntPurposes: [7],
  specialPurposes: [1],
  features: [1],
  specialFeatures: [1],
  dataDeclaration: [1],
  dataRetention: {
    stdRetention: 30,
    purposes: { "1": 90 },
    specialPurposes: {},
  },
  urls: [
    { langId: "fr", privacy: "https://v1.example/fr" },
    {
      langId: "en",
      privacy: "https://v1.example/privacy",
      legIntClaim: "https://v1.example/li",
    },
  ],
  usesCookies: true,
  cookieMaxAgeSeconds: 31536000,
  cookieRefresh: true,
  usesNonCookieAccess: true,
  deviceStorageDisclosureUrl: "https://v1.example/storage.json",
};
vendors[2] = {
  ...(vendors[2] as NonNullable<(typeof vendors)[2]>),
  usesCookies: false,
  urls: [{ langId: "en", privacy: "javascript:alert(1)" }],
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
  specialPurposes: {
    "1": { name: "Ensure security, prevent and detect fraud" },
  },
  features: { "1": { name: "Match and combine data from other data sources" } },
  dataCategories: { "1": { name: "IP addresses" } },
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

  describe("vendor details", () => {
    const details = (host: HTMLElement, name: string) =>
      host.querySelector(
        `button[aria-label="Details: ${name}"]`,
      ) as HTMLButtonElement;
    const panel = (host: HTMLElement) =>
      host.querySelector(
        '[data-cc-part="tcf-vendor-details"]',
      ) as HTMLElement | null;

    it("discloses purposes, retention, policy links and device storage", async () => {
      const { host } = await setup();
      const open = details(host, "Vendor 001");
      expect(open.getAttribute("aria-expanded")).toBe("false");
      await act(async () => open.click());
      const p = panel(host) as HTMLElement;
      expect(open.getAttribute("aria-expanded")).toBe("true");
      expect(open.getAttribute("aria-controls")).toBe(p.id);
      expect(document.activeElement).toBe(p);
      expect(p.getAttribute("aria-labelledby")).toBe(p.querySelector("h4")?.id);
      const text = p.textContent ?? "";
      for (const expected of [
        "Purposes (consent)",
        "Store and/or access information on a device (Data retention: 90 days)",
        "Use limited data to select advertising",
        "Purposes (legitimate interest)",
        "Measure advertising performance",
        "Ensure security, prevent and detect fraud",
        "Match and combine data from other data sources",
        "Use precise geolocation data",
        "IP addresses",
        "Standard retention: 30 days",
        "Cookies stored for up to 365 days",
        "Cookie expiry is refreshed on use",
        "Uses other device storage or access methods",
      ])
        expect(text).toContain(expected);
      const links = [...p.querySelectorAll("a")].map((a) => [
        a.textContent,
        a.getAttribute("href"),
        a.getAttribute("rel"),
      ]);
      expect(links).toEqual([
        [
          "Storage disclosure",
          "https://v1.example/storage.json",
          "noopener noreferrer",
        ],
        ["Privacy policy", "https://v1.example/privacy", "noopener noreferrer"],
        [
          "Legitimate interest claim",
          "https://v1.example/li",
          "noopener noreferrer",
        ],
      ]);
    });

    it("drops unsafe links and says when a vendor uses no cookies", async () => {
      const { host } = await setup();
      await act(async () => details(host, "Vendor 002").click());
      const p = panel(host) as HTMLElement;
      expect(p.textContent).toContain("Does not use cookies");
      expect(p.querySelectorAll("a").length).toBe(0);
    });

    it("Escape and Close return focus to the row's Details button", async () => {
      const { host } = await setup();
      await act(async () => details(host, "Vendor 001").click());
      await act(async () => {
        panel(host)?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      expect(panel(host)).toBeNull();
      expect(document.activeElement).toBe(details(host, "Vendor 001"));
      await act(async () => details(host, "Vendor 001").click());
      await act(async () => button(host, "Close details").click());
      expect(panel(host)).toBeNull();
      expect(document.activeElement).toBe(details(host, "Vendor 001"));
    });

    it("accepts custom labels", async () => {
      const { host, controller, root } = await setup();
      await act(async () =>
        root.render(
          <TcfVendorList
            controller={controller}
            labels={{ details: "Mehr", noCookies: "Keine Cookies" }}
          />,
        ),
      );
      await act(async () =>
        (
          host.querySelector(
            'button[aria-label="Mehr: Vendor 002"]',
          ) as HTMLButtonElement
        ).click(),
      );
      expect(panel(host)?.textContent).toContain("Keine Cookies");
    });
  });

  it("keeps the focused row mounted when it scrolls out of the window", async () => {
    const { host } = await setup();
    const box = checkbox(host, "Consent: Vendor 002");
    await act(async () => box.focus());
    expect(document.activeElement).toBe(box);
    const viewport = host.querySelector(
      '[data-cc-part="tcf-vendors"]',
    ) as HTMLDivElement;
    await act(async () => {
      viewport.scrollTop = 8000;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(box.isConnected).toBe(true);
    expect(document.activeElement).toBe(box);
    const positions = [...rows(host)].map((r) =>
      Number(r.getAttribute("aria-posinset")),
    );
    expect(positions[0]).toBe(2);
    expect(positions.length).toBeLessThanOrEqual(14);
    // Once focus leaves the row it is windowed out again.
    await act(async () => {
      box.blur();
    });
    expect(box.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});
