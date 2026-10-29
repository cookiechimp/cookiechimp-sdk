import { type ReactNode, useEffect, useRef } from "react";
import { CookieChimp, shutdown, store } from "./api";
import type { CookieChimpOptions } from "./engine";
import {
  ConsentBanner,
  ConsentPreferences,
  DebugPanel,
  type Insets,
} from "./ui";

export interface CookieChimpProviderProps extends CookieChimpOptions {
  children?: ReactNode;
  /**
   * Render the built-in banner and preferences. Set false for headless mode:
   * the SDK still loads config, stores decisions, syncs records and controls
   * vendors, and your own screens use the hooks.
   */
  ui?: boolean;
  /** Show the debug panel tab. Defaults to the `debug` option. */
  debugPanel?: boolean;
  /** Safe-area insets for the consent UI, for example from react-native-safe-area-context. */
  insets?: Insets;
}

/**
 * Starts CookieChimp and renders the consent UI above your app. Your app
 * renders immediately; the banner appears once consent and config are loaded.
 * Without `accountId` or `config`, it renders the UI for an SDK started with
 * `CookieChimp.run`.
 */
export function CookieChimpProvider({
  children,
  ui = true,
  insets,
  debugPanel,
  ...options
}: CookieChimpProviderProps) {
  const latest = useRef(options);
  latest.current = options;
  const configured =
    options.accountId !== undefined || options.config !== undefined;
  // Restart only when a setting that changes the config or region changes;
  // callbacks are read from `latest` so new closures never restart the SDK.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    if (!configured) return;
    void CookieChimp.run({
      ...latest.current,
      onAccept: (preferences) => latest.current.onAccept?.(preferences),
      onFirstConsent: (preferences) =>
        latest.current.onFirstConsent?.(preferences),
      onChange: (preferences, categories, services) =>
        latest.current.onChange?.(preferences, categories, services),
    });
    const started = store.engine();
    return () => {
      if (store.engine() === started) shutdown();
    };
  }, [
    configured,
    options.accountId,
    options.config,
    options.country,
    options.language,
    options.geolocation,
    options.syncConsents,
    options.apiBase,
    options.storage,
    options.debug,
    options.fetch,
    options.translations,
  ]);
  return (
    <>
      {children}
      {ui && (
        <>
          <ConsentBanner insets={insets} />
          <ConsentPreferences insets={insets} />
        </>
      )}
      {(debugPanel ?? options.debug === true) && <DebugPanel insets={insets} />}
    </>
  );
}
