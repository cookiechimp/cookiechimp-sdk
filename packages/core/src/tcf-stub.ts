/**
 * Self-contained `__tcfapi` stub (IAB TCF CMP API v2). It answers ping,
 * queues every other command for `installTcf`, and adds the
 * `__tcfapiLocator` frame and postMessage bridge for iframed vendors.
 */
export function installTcfStub(
  win: Window = window,
  gdprApplies?: boolean,
): void {
  // biome-ignore lint/suspicious/noExplicitAny: the stub mutates an untyped global.
  const w = win as any;
  if (typeof w.__tcfapi === "function") return;
  // biome-ignore lint/suspicious/noExplicitAny: callback signature is vendor-defined.
  const api: any = (
    command: string,
    version: unknown,
    callback: (data: unknown, success: boolean) => void,
    parameter: unknown,
  ) => {
    if (typeof callback !== "function") return;
    if (command === "ping")
      return callback(
        {
          gdprApplies,
          cmpLoaded: false,
          cmpStatus: "stub",
          displayStatus: "hidden",
          apiVersion: "2.2",
        },
        true,
      );
    api.queue.push([command, version, callback, parameter]);
  };
  api.queue = [];
  w.__tcfapi = api;
  const frame = () => {
    if (w.frames.__tcfapiLocator) return;
    const body = w.document.body;
    if (!body) return setTimeout(frame, 10);
    const iframe = w.document.createElement("iframe");
    iframe.style.display = "none";
    iframe.name = "__tcfapiLocator";
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
    const call = data?.__tcfapiCall;
    if (!call || typeof call.command !== "string") return;
    w.__tcfapi(
      call.command,
      call.version,
      (returnValue: unknown, success: boolean) => {
        const message = {
          __tcfapiReturn: { returnValue, success, callId: call.callId },
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

/** Inline `<script>` body for the stub. Pass `gdprApplies` when the server knows it. */
export function tcfStubScript(gdprApplies?: boolean): string {
  return `(${installTcfStub.toString()})(window,${gdprApplies === undefined ? "void 0" : String(gdprApplies === true)})`;
}
