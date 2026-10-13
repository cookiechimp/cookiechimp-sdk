"use client";

import type { TcfOptions } from "@cookiechimp/core/tcf";
import { CookieBanner } from "@cookiechimp/react/banner";
import { TcfVendorList } from "@cookiechimp/react/tcf";
import { TcfProvider } from "@cookiechimp/react/tcf-provider";
import { CookiePreferences, RecallButton } from "@cookiechimp/react/ui";
import { useMemo, useState } from "react";

export function TcfProviderDemo({ mode }: { mode: string }) {
  const [mounted, setMounted] = useState(true);
  const options = useMemo<TcfOptions>(
    () => ({
      // A fixture-only ID, not CookieChimp registration or production approval.
      cmpId: mode === "missing-id" ? undefined : 123,
      gvl: async () =>
        (
          await fetch(`/tcf/gvl${mode === "invalid" ? "?invalid=1" : ""}`)
        ).json(),
    }),
    [mode],
  );
  return (
    <section>
      <CookieBanner />
      <RecallButton />
      <button type="button" onClick={() => setMounted(false)}>
        Unmount TCF
      </button>
      {mounted ? (
        <TcfProvider enabled={mode !== "disabled"} options={options}>
          {({ controller, status }) => (
            <>
              <p data-testid="tcf-provider-status">{status}</p>
              <CookiePreferences
                categories={[{ id: "analytics", label: "Analytics" }]}
              >
                {controller ? <TcfVendorList controller={controller} /> : null}
              </CookiePreferences>
            </>
          )}
        </TcfProvider>
      ) : (
        <p>TCF unmounted</p>
      )}
    </section>
  );
}
