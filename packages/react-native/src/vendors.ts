import type { ConsentRuntime } from "@cookiechimp/core";

export interface VendorCallbacks {
  /** Called when consent allows the vendor, for example to enable collection. */
  onStart?: () => void;
  /** Called when consent is withdrawn, for example to disable collection. */
  onStop?: () => void;
}

export interface VendorInfo {
  category: string;
  running: boolean;
}

interface Vendor extends VendorCallbacks {
  name: string;
  category: string;
  running: boolean;
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
  if (allow && !vendor.running) {
    vendor.running = true;
    call(vendor.onStart, vendor.name);
  } else if (!allow && vendor.running) {
    vendor.running = false;
    call(vendor.onStop, vendor.name);
  }
}

/** Re-evaluate every vendor against a consent runtime (or none). */
export function applyVendors(runtime: ConsentRuntime | null) {
  current = runtime;
  for (const vendor of vendors.values()) settle(vendor);
}

export function registerVendor(
  name: string,
  category: string,
  callbacks: VendorCallbacks = {},
) {
  const previous = vendors.get(name);
  const vendor: Vendor = {
    name,
    category,
    ...callbacks,
    running: previous?.running ?? false,
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
  if (vendor && !vendor.running) {
    vendor.running = true;
    call(vendor.onStart, name);
  }
}

export function stopVendor(name: string) {
  const vendor = vendors.get(name);
  if (vendor?.running) {
    vendor.running = false;
    call(vendor.onStop, name);
  }
}

export const isVendorRunning = (name: string) =>
  vendors.get(name)?.running === true;

export function getVendors(): Record<string, VendorInfo> {
  return Object.fromEntries(
    [...vendors.values()].map(({ name, category, running }) => [
      name,
      { category, running },
    ]),
  );
}

/** Test helper: forget every vendor. */
export function clearVendors() {
  vendors.clear();
  current = null;
}
