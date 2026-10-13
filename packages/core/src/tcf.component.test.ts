import { TCString } from "@iabtcf/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsentRuntime, ConsentState } from "./index";
import { type Gvl, installTcf } from "./tcf";
import { installTcfStub, tcfStubScript } from "./tcf-stub";

type Api = (
  command: string,
  version: unknown,
  callback: (d: unknown, ok: boolean) => void,
  p?: unknown,
) => void;
const tcf = () => (window as unknown as { __tcfapi?: Api }).__tcfapi;
const call = (command: string, parameter?: unknown, version: unknown = 2) =>
  new Promise<[unknown, boolean]>((resolve) =>
    tcf()?.(command, version, (data, ok) => resolve([data, ok]), parameter),
  );

const gvl: Gvl = {
  vendorListVersion: 150,
  tcfPolicyVersion: 5,
  vendors: {
    "1": {
      id: 1,
      purposes: [1, 2, 3, 4],
      legIntPurposes: [7],
      specialFeatures: [],
    },
    "2": { id: 2, purposes: [1, 8], legIntPurposes: [], specialFeatures: [] },
  },
};

function runtime(
  categories: Record<string, boolean>,
  { regulation = "gdpr", needsDecision = false } = {},
) {
  let state = {
    categories,
    ts: "2026-10-13T10:00:00.000Z",
  } as unknown as ConsentState;
  const listeners = new Set<(s: ConsentState) => void>();
  return {
    regulation,
    get needsDecision() {
      return needsDecision;
    },
    language: "en",
    get: () => state,
    subscribe(listener: (s: ConsentState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(next: Record<string, boolean>) {
      needsDecision = false;
      state = { ...state, categories: next };
      for (const l of listeners) l(state);
    },
  } as unknown as ConsentRuntime & {
    update(next: Record<string, boolean>): void;
  };
}

afterEach(() => {
  delete (window as unknown as { __tcfapi?: unknown }).__tcfapi;
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("__tcfapi stub", () => {
  it("answers ping, queues other commands, and adds the locator frame", async () => {
    installTcfStub(window, true);
    expect(await call("ping")).toEqual([
      {
        gdprApplies: true,
        cmpLoaded: false,
        cmpStatus: "stub",
        displayStatus: "hidden",
        apiVersion: "2.2",
      },
      true,
    ]);
    tcf()?.("addEventListener", 2, () => {});
    expect((tcf() as unknown as { queue: unknown[] }).queue).toHaveLength(1);
    expect(
      document.querySelector('iframe[name="__tcfapiLocator"]'),
    ).not.toBeNull();
  });

  it("never replaces an existing CMP and evaluates from the inline script", () => {
    const existing = vi.fn();
    (window as unknown as { __tcfapi: unknown }).__tcfapi = existing;
    new Function(tcfStubScript(true))();
    expect(tcf()).toBe(existing);
    delete (window as unknown as { __tcfapi?: unknown }).__tcfapi;
    new Function(tcfStubScript(false))();
    expect(typeof tcf()).toBe("function");
  });

  it("answers cross-frame __tcfapiCall messages", async () => {
    installTcfStub(window, true);
    const source = { postMessage: vi.fn() };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { __tcfapiCall: { command: "ping", version: 2, callId: "a1" } },
        source: source as unknown as Window,
      }),
    );
    await vi.waitFor(() => expect(source.postMessage).toHaveBeenCalled());
    expect(source.postMessage.mock.calls[0]?.[0]).toMatchObject({
      __tcfapiReturn: {
        callId: "a1",
        success: true,
        returnValue: { cmpStatus: "stub" },
      },
    });
  });
});

describe("installTcf", () => {
  it("replays queued listeners and emits tcloaded with a reference-decodable string", async () => {
    installTcfStub(window, true);
    const events: Record<string, unknown>[] = [];
    tcf()?.("addEventListener", 2, (data) =>
      events.push(data as Record<string, unknown>),
    );
    const controller = installTcf(runtime({ marketing: true }), {
      cmpId: 300,
      gvl,
    });
    await controller.ready;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventStatus: "tcloaded",
      cmpStatus: "loaded",
      gdprApplies: true,
      cmpId: 300,
      listenerId: 1,
    });
    const decoded = TCString.decode(controller.tcString);
    expect(decoded.cmpId).toBe(300);
    expect(decoded.vendorConsents.has(1)).toBe(true);
    expect(decoded.vendorConsents.has(2)).toBe(false);
    expect(decoded.vendorsDisclosed.has(2)).toBe(true);
    const [ping] = (await call("ping")) as [Record<string, unknown>, boolean];
    expect(ping).toMatchObject({
      cmpLoaded: true,
      cmpStatus: "loaded",
      displayStatus: "hidden",
      gvlVersion: 150,
      tcfPolicyVersion: 5,
    });
  });

  it("shows cmpuishown before a decision and useractioncomplete after it", async () => {
    const rt = runtime({ marketing: false }, { needsDecision: true });
    const controller = installTcf(rt, { cmpId: 300, gvl: async () => gvl });
    const events: Record<string, unknown>[] = [];
    tcf()?.("addEventListener", 2, (data) =>
      events.push(data as Record<string, unknown>),
    );
    await controller.ready;
    expect(events[0]).toMatchObject({ eventStatus: "cmpuishown" });
    expect(TCString.decode(controller.tcString).vendorConsents.size).toBe(0);
    rt.update({ marketing: true, analytics: true });
    expect(events[1]).toMatchObject({ eventStatus: "useractioncomplete" });
    expect(TCString.decode(controller.tcString).vendorConsents.size).toBe(2);
  });

  it("removes listeners, rejects unsupported versions and the deprecated getTCData", async () => {
    const controller = installTcf(runtime({ marketing: true }), {
      cmpId: 300,
      gvl,
    });
    await controller.ready;
    const [registered] = (await call("addEventListener")) as [
      { listenerId: number },
      boolean,
    ];
    expect(await call("removeEventListener", registered.listenerId)).toEqual([
      true,
      true,
    ]);
    expect(await call("removeEventListener", 999)).toEqual([false, true]);
    expect(await call("getTCData")).toEqual([null, false]);
    expect(await call("addEventListener", undefined, 1)).toEqual([null, false]);
  });

  it("reports gdprApplies false with an empty string outside GDPR", async () => {
    const controller = installTcf(runtime({}, { regulation: "ccpa" }), {
      cmpId: 300,
      gvl,
    });
    await controller.ready;
    const [data] = (await call("addEventListener")) as [
      Record<string, unknown>,
      boolean,
    ];
    expect(data).toMatchObject({ gdprApplies: false, tcString: "" });
    expect(
      ((await call("ping")) as [Record<string, unknown>, boolean])[0]
        .displayStatus,
    ).toBe("disabled");
  });

  it("isolates throwing vendor callbacks", async () => {
    const rt = runtime({ marketing: true });
    const controller = installTcf(rt, { cmpId: 300, gvl });
    await controller.ready;
    tcf()?.("addEventListener", 2, () => {
      throw new Error("vendor");
    });
    const good = vi.fn();
    tcf()?.("addEventListener", 2, good);
    rt.update({ marketing: false });
    expect(good).toHaveBeenCalledTimes(2);
  });

  it("fails closed in production without a cmpId: error status, ping only, queue dropped", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    installTcfStub(window, true);
    const queued = vi.fn();
    tcf()?.("addEventListener", 2, queued);
    const controller = installTcf(runtime({ marketing: true }), { gvl });
    await controller.ready;
    expect(controller.enabled).toBe(false);
    expect(controller.tcString).toBe("");
    tcf()?.("addEventListener", 2, queued);
    expect(queued).not.toHaveBeenCalled();
    expect(
      ((await call("ping")) as [Record<string, unknown>, boolean])[0],
    ).toMatchObject({ cmpStatus: "error", cmpLoaded: false });
    expect(error.mock.calls.map((c) => String(c[0])).join(" ")).toMatch(
      /cmpId is required in production/,
    );
  });

  it("uses cmpId 0 with a warning in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = installTcf(runtime({ marketing: true }), { gvl });
    await controller.ready;
    expect(controller.enabled).toBe(true);
    // The IAB reference rejects CMP ID 0, which is why it is development only.
    expect(() => TCString.decode(controller.tcString)).toThrow(/cmpId/);
    expect(warn).toHaveBeenCalled();
  });

  it("fails closed when the GVL loader rejects or returns invalid data", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const rejected = installTcf(runtime({ marketing: true }), {
      cmpId: 300,
      gvl: () => Promise.reject(new Error("cdn")),
    });
    await rejected.ready;
    expect(rejected.enabled).toBe(false);
    rejected.stop();
    const invalid = installTcf(runtime({ marketing: true }), {
      cmpId: 300,
      gvl: async () => ({ vendors: [] }),
    });
    await invalid.ready;
    expect(invalid.enabled).toBe(false);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("stop() removes its own __tcfapi", async () => {
    const controller = installTcf(runtime({ marketing: true }), {
      cmpId: 300,
      gvl,
    });
    await controller.ready;
    controller.stop();
    expect(tcf()).toBeUndefined();
  });
});
