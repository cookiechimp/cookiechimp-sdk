"use client";

import type { ConsentRuntime } from "@cookiechimp/core";
import type { TcfController, TcfOptions } from "@cookiechimp/core/tcf";
import { useHeadlessContext } from "@cookiechimp/react";
import { type ReactNode, useEffect, useState } from "react";

export interface TcfProviderState {
  controller: TcfController | null;
  status: "disabled" | "loading" | "ready" | "error";
}
export interface TcfProviderProps {
  /** Explicit opt-in from the application's server-owned feature decision. */
  enabled?: boolean;
  /** Keep stable (module scope or useMemo); a changed object reinstalls the CMP. */
  options: TcfOptions;
  children: (state: TcfProviderState) => ReactNode;
}
interface Binding extends TcfProviderState {
  runtime: ConsentRuntime;
  options: TcfOptions;
}

/**
 * Bind the optional TCF controller to the surrounding consent runtime. The core
 * loads after hydration only when enabled. Applications supply the registered
 * CMP ID, GVL and authoritative connected/Pro feature decision.
 */
export function TcfProvider({
  enabled = false,
  options,
  children,
}: TcfProviderProps) {
  const runtime = useHeadlessContext()?.consent;
  const [binding, setBinding] = useState<Binding | null>(null);
  useEffect(() => {
    if (enabled !== true || !runtime) return;
    let live = true;
    let controller: TcfController | undefined;
    const error = () => {
      if (live)
        setBinding({ runtime, options, controller: null, status: "error" });
    };
    import("@cookiechimp/core/tcf").then(({ installTcf }) => {
      if (!live) return;
      try {
        controller = installTcf(runtime, options);
        const installed = controller;
        installed.ready.then(() => {
          if (!live) return;
          if (!installed.enabled || !installed.gvl) return error();
          setBinding({
            runtime,
            options,
            controller: installed,
            status: "ready",
          });
        }, error);
      } catch {
        error();
      }
    }, error);
    return () => {
      live = false;
      controller?.stop();
      setBinding(null);
    };
  }, [enabled, runtime, options]);
  // A replaced configuration must never expose the previous controller in the
  // render before effect cleanup runs, even if its old GVL finishes later.
  const active = enabled === true && runtime;
  const current =
    active && binding?.runtime === runtime && binding.options === options
      ? binding
      : null;
  return children({
    controller: current?.controller ?? null,
    status: active ? (current?.status ?? "loading") : "disabled",
  });
}
