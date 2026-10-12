import type {
  ConsentModeMapping,
  QueueStub,
  QueueTarget,
  ScriptPreset,
} from "./index";

export function validateId(kind: string, id: string, expression: RegExp): void {
  if (expression.test(id)) return;
  const message = `CookieChimp ${kind} id ${JSON.stringify(id)} is invalid`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(message);
  console.warn(message);
}
export function queue(
  dataLayerName = "dataLayer",
  defaults = false,
): QueueStub {
  return {
    dataLayerName,
    install(target = globalThis as unknown as QueueTarget) {
      const host = target as QueueTarget & Record<string, unknown>;
      host[dataLayerName] ??= [];
      const layer = host[dataLayerName] as unknown[];
      const gtag =
        host.gtag ??
        function () {
          // biome-ignore lint/complexity/noArguments: gtag queues its argument object by convention.
          layer.push(arguments);
        };
      host.gtag = gtag;
      if (defaults)
        gtag("consent", "default", {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          security_storage: "granted",
          wait_for_update: 500,
        });
      return gtag;
    },
  };
}
export function preset(
  id: string,
  category: string,
  src: string,
  scripts: string[],
  domains: string[],
  mapping: ConsentModeMapping,
  nonce?: string,
  immediate = false,
  dataLayerName = "dataLayer",
): ScriptPreset {
  const attributes: Record<string, string> = immediate
    ? { src, async: "" }
    : {
        type: "text/plain",
        "data-cc-src": src,
        "data-cc-category": category,
        "data-cc-service": id,
        async: "",
      };
  if (nonce) attributes.nonce = nonce;
  return {
    id,
    category,
    service: { id, category, scripts, domains },
    consentMode: mapping,
    script: { src, attributes, ...(nonce ? { nonce } : {}) },
    queue: queue(dataLayerName, immediate),
    load: immediate ? "immediate" : "gated",
  };
}
