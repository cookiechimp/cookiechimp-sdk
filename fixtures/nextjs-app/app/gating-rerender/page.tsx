"use client";

import { useConsentActions } from "@cookiechimp/react";
import { GatedScript } from "@cookiechimp/react/ui";
import { useState } from "react";

export default function GatingRerender() {
  const [siblings, setSiblings] = useState(false);
  const [mounted, setMounted] = useState(true);
  const { acceptAll, rejectAll } = useConsentActions();
  return (
    <main>
      <h1>Script reconciliation regression</h1>
      <button type="button" onClick={acceptAll}>
        Grant scripts
      </button>
      <button type="button" onClick={rejectAll}>
        Revoke scripts
      </button>
      <button type="button" onClick={() => setSiblings((value) => !value)}>
        Toggle siblings
      </button>
      <button type="button" onClick={() => setMounted(false)}>
        Unmount scripts
      </button>
      {siblings ? <p>Before script</p> : null}
      {mounted ? (
        <GatedScript category="analytics">
          {"window.__ccRuns = (window.__ccRuns || 0) + 1;"}
        </GatedScript>
      ) : null}
      {siblings ? <p>After script</p> : null}
      {mounted ? (
        <GatedScript category="analytics">
          {"window.__ccOtherRuns = (window.__ccOtherRuns || 0) + 1;"}
        </GatedScript>
      ) : null}
    </main>
  );
}
