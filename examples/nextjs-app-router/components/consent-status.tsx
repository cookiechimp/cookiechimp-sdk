"use client";

import { useCategory, usePreferences } from "@cookiechimp/react";

export function ConsentStatus() {
  const analytics = useCategory("analytics");
  const preferences = usePreferences();
  return (
    <section>
      <p data-testid="analytics-status">
        Analytics is {analytics ? "allowed" : "not allowed"}.
      </p>
      <button type="button" onClick={preferences.show}>
        Change cookie settings
      </button>
    </section>
  );
}
