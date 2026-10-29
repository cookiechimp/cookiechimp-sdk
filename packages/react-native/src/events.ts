/** One line in the SDK's activity log, shown in the debug panel. */
export interface DebugEvent {
  /** Milliseconds since the epoch. */
  at: number;
  kind: "sdk" | "config" | "consent" | "vendor" | "records" | "error";
  message: string;
}

const MAX = 100;
let events: readonly DebugEvent[] = [];
const listeners = new Set<() => void>();

/** Add an event, keeping the most recent 100. Never throws. */
export function track(kind: DebugEvent["kind"], message: string) {
  events = [{ at: Date.now(), kind, message }, ...events].slice(0, MAX);
  for (const listener of listeners) listener();
}

export const debugEvents = {
  /** Newest first. */
  get: (): readonly DebugEvent[] => events,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  clear() {
    events = [];
    for (const listener of listeners) listener();
  },
};
