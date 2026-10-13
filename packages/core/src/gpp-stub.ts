/**
 * Self-contained `__gpp` stub (IAB GPP CMP API v1.1). It answers ping,
 * registers listeners for the full API to adopt, returns null for section
 * reads and queues everything else. Inline it with `gppStubScript` before any
 * vendor tag, then load `@cookiechimp/core/gpp` lazily.
 */
export function installGppStub(win: Window = window): void {
  // biome-ignore lint/suspicious/noExplicitAny: the stub mutates an untyped global.
  const w = win as any;
  if (typeof w.__gpp === "function") return;
  const ping = () => ({
    gppVersion: "1.1",
    cmpStatus: "stub",
    cmpDisplayStatus: "hidden",
    signalStatus: "not ready",
    supportedAPIs: [
      "7:usnat",
      "8:usca",
      "9:usva",
      "10:usco",
      "11:usut",
      "12:usct",
      "13:usfl",
      "14:usmt",
      "15:usor",
      "16:ustx",
      "17:usde",
      "18:usia",
      "19:usne",
      "20:usnh",
      "21:usnj",
      "22:ustn",
    ],
    cmpId: 0,
    sectionList: [],
    applicableSections: [0],
    gppString: "",
    parsedSections: {},
  });
  // biome-ignore lint/suspicious/noExplicitAny: callback signature is vendor-defined.
  const gpp: any = (command: string, callback?: any, parameter?: unknown) => {
    const cb = typeof callback === "function" ? callback : () => {};
    if (command === "ping") return cb(ping(), true);
    if (command === "addEventListener") {
      gpp.lastId = (gpp.lastId || 0) + 1;
      const id = gpp.lastId;
      gpp.events.push({ id, callback: cb });
      return cb(
        {
          eventName: "listenerRegistered",
          listenerId: id,
          data: true,
          pingData: ping(),
        },
        true,
      );
    }
    if (command === "removeEventListener") {
      // biome-ignore lint/suspicious/noExplicitAny: queued listener record.
      const i = gpp.events.findIndex((e: any) => e.id === parameter);
      if (i >= 0) gpp.events.splice(i, 1);
      return cb(
        {
          eventName: "listenerRemoved",
          listenerId: parameter,
          data: i >= 0,
          pingData: ping(),
        },
        true,
      );
    }
    if (/^(hasSection|getSection|getField)$/.test(command))
      return cb(null, false);
    gpp.queue.push([command, callback, parameter]);
  };
  gpp.queue = [];
  gpp.events = [];
  w.__gpp = gpp;
  const frame = () => {
    if (w.frames.__gppLocator) return;
    const body = w.document.body;
    if (!body) return setTimeout(frame, 10);
    const iframe = w.document.createElement("iframe");
    iframe.style.display = "none";
    iframe.name = "__gppLocator";
    body.appendChild(iframe);
  };
  frame();
  // biome-ignore lint/suspicious/noExplicitAny: cross-frame message payload.
  w.addEventListener("message", (event: any) => {
    let data = event.data;
    try {
      if (typeof data === "string") data = JSON.parse(data);
    } catch {
      return;
    }
    const call = data?.__gppCall;
    if (!call || typeof call.command !== "string") return;
    w.__gpp(
      call.command,
      (returnValue: unknown, success: boolean) => {
        const message = {
          __gppReturn: { returnValue, success, callId: call.callId },
        };
        event.source?.postMessage(
          typeof event.data === "string" ? JSON.stringify(message) : message,
          "*",
        );
      },
      call.parameter,
    );
  });
}

/** Inline `<script>` body for the stub. */
export const gppStubScript = `(${installGppStub.toString()})(window)`;
