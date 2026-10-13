"use client";

import {
  useCategory,
  useConsentActions,
  useTranslations,
} from "@cookiechimp/react";
import en from "@cookiechimp/translations/en";

function Category({ id }: { id: string }) {
  const granted = useCategory(id);
  return (
    <li data-category={id}>
      {id}: {granted ? "on" : "off"}
    </li>
  );
}

export function ConnectedDemo() {
  const { t } = useTranslations(en);
  const actions = useConsentActions();
  return (
    <section>
      <h2 data-testid="banner-title">{t("banner.title")}</h2>
      <button type="button" onClick={() => actions.acceptAll()}>
        {t("banner.acceptAll")}
      </button>
      <ul>
        {["local-only", "analytics", "marketing"].map((id) => (
          <Category key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}
