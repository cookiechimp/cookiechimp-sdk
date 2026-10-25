import { GppModel } from "@iabgpp/cmpapi";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installGpp } from "./gpp";
import { gppStubScript, installGppStub } from "./gpp-stub";
import type { ConsentRuntime, ConsentState } from "./index";
import type { Region } from "./regions";

type Gpp = (
  command: string,
  callback?: unknown,
  parameter?: unknown,
) => unknown;
const gpp = () => (window as unknown as { __gpp: Gpp }).__gpp;
const call = (command: string, parameter?: unknown) =>
  new Promise<[unknown, boolean]>((resolve) =>
    gpp()(
      command,
      (data: unknown, ok: boolean) => resolve([data, ok]),
      parameter,
    ),
  );

function runtime(
  categories: Record<string, boolean>,
  {
    region = { country: "US", region: "CA" } as Region,
    gpc = false,
    needsDecision = false,
  }: { region?: Region; gpc?: boolean; needsDecision?: boolean } = {},
) {
  let state = { categories, gpc } as unknown as ConsentState;
  const listeners = new Set<(state: ConsentState) => void>();
  return {
    region,
    gpc,
    needsDecision,
    get: () => state,
    subscribe(listener: (state: ConsentState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(next: Record<string, boolean>) {
      state = { ...state, categories: next };
      for (const listener of listeners) listener(state);
    },
  } as unknown as ConsentRuntime & {
    update(next: Record<string, boolean>): void;
  };
}

afterEach(() => {
  delete (window as unknown as { __gpp?: unknown }).__gpp;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("__gpp stub", () => {
  it("answers ping, null section reads, and adds the __gppLocator frame", async () => {
    installGppStub();
    const [ping, ok] = await call("ping");
    expect(ok).toBe(true);
    expect(ping).toMatchObject({
      gppVersion: "1.1",
      cmpStatus: "stub",
      cmpId: 0,
      gppString: "",
    });
    expect(await call("getSection", "usca")).toEqual([null, false]);
    expect(
      document.querySelector('iframe[name="__gppLocator"]'),
    ).not.toBeNull();
  });

  it("is idempotent and never replaces an existing CMP", () => {
    const existing = vi.fn();
    (window as unknown as { __gpp: unknown }).__gpp = existing;
    installGppStub();
    expect(gpp()).toBe(existing);
  });

  it("evaluates from the inline script string", () => {
    new Function(gppStubScript)();
    expect(typeof gpp()).toBe("function");
    expect(gppStubScript.length).toBeLessThan(4000);
  });

  it("answers cross-frame __gppCall messages", async () => {
    installGppStub();
    const source = { postMessage: vi.fn() };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ __gppCall: { command: "ping", callId: 7 } }),
        source: source as unknown as Window,
      }),
    );
    await vi.waitFor(() => expect(source.postMessage).toHaveBeenCalled());
    const reply = JSON.parse(source.postMessage.mock.calls[0]?.[0] as string);
    expect(reply.__gppReturn).toMatchObject({ callId: 7, success: true });
    expect(reply.__gppReturn.returnValue.cmpStatus).toBe("stub");
  });
});

describe("installGpp", () => {
  it("adopts stub listeners, replays the queue, and fires loaded then ready", () => {
    installGppStub();
    const events: string[] = [];
    gpp()("addEventListener", (event: { eventName: string; data: unknown }) =>
      events.push(`${event.eventName}:${String(event.data)}`),
    );
    const queued = vi.fn();
    gpp()("customCommand", queued);
    installGpp(runtime({ marketing: true }));
    expect(events).toEqual([
      "listenerRegistered:true",
      "cmpStatus:loaded",
      "signalStatus:ready",
    ]);
    expect(queued).toHaveBeenCalledWith(null, false);
  });

  it("exposes a reference-decodable usca string with the right fields", async () => {
    installGppStub();
    const controller = installGpp(runtime({ marketing: true }));
    const [ping] = (await call("ping")) as [Record<string, unknown>, boolean];
    expect(ping).toMatchObject({
      cmpStatus: "loaded",
      signalStatus: "ready",
      applicableSections: [8],
      cmpId: 0,
    });
    expect(ping.gppString).toBe(controller.gppString);
    const model = new GppModel(controller.gppString);
    expect(model.getFieldValue("usca", "SaleOptOut")).toBe(2);
    expect(model.getFieldValue("usca", "Gpc")).toBe(false);
    expect(await call("hasSection", "usca")).toEqual([true, true]);
    expect(await call("getField", "usca.SharingOptOut")).toEqual([2, true]);
    expect(await call("hasSection", "toString")).toEqual([false, true]);
    expect(await call("getField", "usca.constructor")).toEqual([null, true]);
  });

  it("signals not ready, the section, then ready on every consent change", () => {
    const rt = runtime(
      { marketing: true },
      { region: { country: "US", region: "OH" } },
    );
    installGpp(rt);
    const events: string[] = [];
    gpp()("addEventListener", (event: { eventName: string }) =>
      events.push(event.eventName),
    );
    events.length = 0;
    rt.update({ marketing: false });
    expect(events).toEqual(["signalStatus", "usnat", "signalStatus"]);
    expect(
      new GppModel(
        (gpp()("ping") as { gppString: string }).gppString,
      ).getFieldValue("usnat", "SaleOptOut"),
    ).toBe(1);
  });

  it("maps GPC to opted out with the GPC flag set", () => {
    const controller = installGpp(
      runtime(
        { marketing: true },
        { region: { country: "US", region: "CO" }, gpc: true },
      ),
    );
    const model = new GppModel(controller.gppString);
    expect(model.getFieldValue("usco", "SaleOptOut")).toBe(1);
    expect(model.getFieldValue("usco", "Gpc")).toBe(true);
  });

  it("fails closed before a decision and reports no section outside the US", async () => {
    const pending = installGpp(
      runtime({ marketing: true }, { needsDecision: true }),
    );
    expect(
      new GppModel(pending.gppString).getFieldValue("usca", "SaleOptOut"),
    ).toBe(1);
    pending.stop();
    installGpp(runtime({ marketing: true }, { region: { country: "IE" } }));
    const [ping] = (await call("ping")) as [Record<string, unknown>, boolean];
    expect(ping).toMatchObject({ applicableSections: [-1], gppString: "" });
  });

  it("isolates throwing vendor listeners and removes listeners", async () => {
    const rt = runtime({ marketing: true });
    installGpp(rt);
    const good = vi.fn();
    gpp()("addEventListener", () => {
      throw new Error("vendor");
    });
    const [registered] = (await call("addEventListener")) as [
      { listenerId: number },
      boolean,
    ];
    gpp()("addEventListener", good);
    expect(
      await call("removeEventListener", registered.listenerId),
    ).toMatchObject([{ data: true }, true]);
    rt.update({ marketing: false });
    expect(good).toHaveBeenCalled();
  });

  it("stop() unsubscribes and removes its own __gpp", () => {
    const controller = installGpp(runtime({ marketing: true }));
    controller.stop();
    expect(gpp()).toBeUndefined();
  });
});

it.each([
  ["MN", "usmn", 23],
  ["MD", "usmd", 24],
  ["IN", "usin", 25],
  ["KY", "usky", 26],
  ["RI", "usri", 27],
] as const)(
  "%s exposes its own section through the CMP API and updates preferences",
  async (state, prefix, id) => {
    const consent = runtime(
      { advertising: true, marketing: true },
      { region: { country: "US", region: state } },
    );
    const controller = installGpp(consent);
    try {
      const [ping] = await call("ping");
      expect(ping).toMatchObject({
        applicableSections: [id],
        sectionList: [id],
      });
      expect((ping as { supportedAPIs: string[] }).supportedAPIs).toEqual(
        expect.arrayContaining([
          "23:usmn",
          "24:usmd",
          "25:usin",
          "26:usky",
          "27:usri",
        ]),
      );
      expect(await call("hasSection", "usnat")).toEqual([false, true]);
      expect(await call("getField", `${prefix}.SaleOptOut`)).toEqual([2, true]);
      consent.update({ advertising: false, marketing: false });
      expect(await call("getField", `${prefix}.SaleOptOut`)).toEqual([1, true]);
      if (state !== "MN")
        expect(await call("getField", `${prefix}.MspaVersion`)).toEqual([
          1,
          true,
        ]);
    } finally {
      controller.stop();
    }
  },
);
