"use client";

import { useEffect, useState } from "react";

export function BenchmarkPage() {
  const [clicks, setClicks] = useState(0);
  useEffect(() => {
    performance.mark("bench-hydrated");
    document.documentElement.dataset.benchHydrated = "true";
  }, []);
  return (
    <main>
      <h1>Consent benchmark</h1>
      <p>An identical minimal Next.js page for every consent manager.</p>
      <button type="button" onClick={() => setClicks((value) => value + 1)}>
        Page action
      </button>
      <output aria-label="Page clicks">{clicks}</output>
    </main>
  );
}
