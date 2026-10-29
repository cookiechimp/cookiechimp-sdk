import type { ConsentRuntime } from "@cookiechimp/core";
import { track } from "./events";

export interface VendorCallbacks {
  /** Called when consent allows the vendor, for example to enable collection. */
  onStart?: () => void;
  /**
   * Called when consent does not allow the vendor, for example to disable
   * collection: when consent is withdrawn, and once when the vendor registers
   * without consent, so a setting the SDK kept from an earlier launch is
   * switched off.
   */
  onStop?: () => void;
}

/**
 * A ready-made vendor: its dashboard service name, default category and the
 * callbacks that switch its SDK on and off. See `presets`.
 */
export interface VendorPreset extends Required<VendorCallbacks> {
  name: string;
  category: string;
}

export interface VendorInfo {
  category: string;
  running: boolean;
}

interface Vendor extends VendorCallbacks {
  name: string;
  category: string;
  // Undefined until the first settle: an SDK can keep its last state from an
  // earlier launch, so a new vendor counts as neither started nor stopped.
  running: boolean | undefined;
}

/** The SDK id of a service name, matching the platform adapter in core. */
export const serviceId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const vendors = new Map<string, Vendor>();
let current: ConsentRuntime | null = null;

const call = (fn: (() => void) | undefined, name: string) => {
  try {
    fn?.();
  } catch (error) {
    console.error(`CookieChimp vendor "${name}" callback failed`, error);
  }
};

function allowed(vendor: Vendor, runtime: ConsentRuntime): boolean {
  const id = serviceId(vendor.name);
  return runtime.get().services?.[id] !== undefined
    ? runtime.hasService(id)
    : runtime.has(vendor.category);
}

function settle(vendor: Vendor) {
  // Fail closed: nothing starts until a consent runtime exists.
  const allow = current ? allowed(vendor, current) : false;
  if (allow && vendor.running !== true) {
    vendor.running = true;
    track("vendor", `${vendor.name} started`);
    call(vendor.onStart, vendor.name);
  } else if (!allow && vendor.running !== false) {
    const message =
      vendor.running === undefined ? "off until consent allows it" : "stopped";
    vendor.running = false;
    track("vendor", `${vendor.name} ${message}`);
    call(vendor.onStop, vendor.name);
  }
}

/** Re-evaluate every vendor against a consent runtime (or none). */
export function applyVendors(runtime: ConsentRuntime | null) {
  current = runtime;
  for (const vendor of vendors.values()) settle(vendor);
}

/**
 * Register a vendor SDK by name and category, or a preset. It starts when
 * consent allows it; otherwise it is stopped right away. A preset's name
 * and category can be overridden, for example
 * `registerVendor(presets.mixpanel(mixpanel), { category: "marketing" })`.
 */
export function registerVendor(
  preset: VendorPreset,
  overrides?: { name?: string; category?: string },
): void;
export function registerVendor(
  name: string,
  category: string,
  callbacks?: VendorCallbacks,
): void;
export function registerVendor(
  nameOrPreset: string | VendorPreset,
  categoryOrOverrides?: string | { name?: string; category?: string },
  maybeCallbacks: VendorCallbacks = {},
) {
  const preset = typeof nameOrPreset === "string" ? undefined : nameOrPreset;
  const overrides =
    typeof categoryOrOverrides === "object" ? categoryOrOverrides : {};
  const name = overrides.name ?? preset?.name ?? (nameOrPreset as string);
  const category =
    overrides.category ??
    preset?.category ??
    (typeof categoryOrOverrides === "string" ? categoryOrOverrides : "");
  const callbacks: VendorCallbacks = preset
    ? { onStart: preset.onStart, onStop: preset.onStop }
    : maybeCallbacks;
  const previous = vendors.get(name);
  const vendor: Vendor = {
    name,
    category,
    ...callbacks,
    running: previous?.running,
  };
  vendors.set(name, vendor);
  settle(vendor);
}

export function unregisterVendor(name: string) {
  vendors.delete(name);
}

/** Start a vendor regardless of consent. Use only for an explicit app decision. */
export function startVendor(name: string) {
  const vendor = vendors.get(name);
  if (vendor && vendor.running !== true) {
    vendor.running = true;
    track("vendor", `${name} started by the app`);
    call(vendor.onStart, name);
  }
}

export function stopVendor(name: string) {
  const vendor = vendors.get(name);
  if (vendor && vendor.running !== false) {
    vendor.running = false;
    track("vendor", `${name} stopped by the app`);
    call(vendor.onStop, name);
  }
}

export const isVendorRunning = (name: string) =>
  vendors.get(name)?.running === true;

export function getVendors(): Record<string, VendorInfo> {
  return Object.fromEntries(
    [...vendors.values()].map(({ name, category, running }) => [
      name,
      { category, running: running === true },
    ]),
  );
}

/** Test helper: forget every vendor. */
export function clearVendors() {
  vendors.clear();
  current = null;
}
