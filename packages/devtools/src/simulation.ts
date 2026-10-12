import type { Region } from "@cookiechimp/core";

/** sessionStorage key holding the simulated region and GPC signal. */
export const SIMULATION_KEY = "cc_devtools_simulation";

export interface Simulation {
  region?: Region | null;
  gpc?: boolean;
}

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem" | "removeItem">;

const COUNTRY = /^[A-Z]{2}$/;
const SUBDIVISION = /^[A-Z0-9]{1,3}$/;

function session(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Keep only well-formed fields, so stored or typed input can never smuggle other values. */
export function cleanSimulation(input: unknown): Simulation | null {
  if (!input || typeof input !== "object") return null;
  const { region, gpc } = input as Record<string, unknown>;
  const out: Simulation = {};
  if (region === null) out.region = null;
  else if (region && typeof region === "object") {
    const { country, region: sub } = region as Record<string, unknown>;
    if (typeof country !== "string" || !COUNTRY.test(country)) return null;
    if (
      sub !== undefined &&
      (typeof sub !== "string" || !SUBDIVISION.test(sub))
    )
      return null;
    out.region = sub === undefined ? { country } : { country, region: sub };
  } else if (region !== undefined) return null;
  if (gpc !== undefined) {
    if (typeof gpc !== "boolean") return null;
    out.gpc = gpc;
  }
  return out;
}

/**
 * Read the simulation saved by the devtools panel. Pass the result to
 * `createConsent({ ...config, ...readSimulation() })` in development only.
 * Malformed stored data is ignored, never thrown.
 */
export function readSimulation(storage: Reader | undefined = session()) {
  try {
    const raw = storage?.getItem(SIMULATION_KEY);
    return raw ? cleanSimulation(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Save a simulation. Invalid input throws in development and warns in production. */
export function writeSimulation(
  simulation: Simulation,
  storage: Writer | undefined = session(),
): boolean {
  const clean = cleanSimulation(simulation);
  if (!clean) {
    const message = `CookieChimp devtools simulation ${JSON.stringify(simulation)} is invalid`;
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
      throw new TypeError(message);
    console.warn(message);
    return false;
  }
  storage?.setItem(SIMULATION_KEY, JSON.stringify(clean));
  return true;
}

export function clearSimulation(storage: Writer | undefined = session()) {
  storage?.removeItem(SIMULATION_KEY);
}
