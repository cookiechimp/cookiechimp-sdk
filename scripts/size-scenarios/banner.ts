import { ConsentProvider } from "@cookiechimp/react";
import { CookieBanner } from "@cookiechimp/react/banner";
import { createElement } from "react";

const config = {
  categories: ["analytics", "marketing"],
};

export const BannerScenario = () =>
  createElement(ConsentProvider, {
    config,
    children: createElement(CookieBanner),
  });
