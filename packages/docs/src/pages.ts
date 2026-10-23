export interface PageSpec {
  slug: string;
  title: string;
  description: string;
  source: string;
}

export const pages: readonly PageSpec[] = [
  {
    slug: "overview",
    title: "Consent SDK",
    description: "CookieChimp consent for React, Next.js and plain JavaScript.",
    source: "packages/docs/content/index.md",
  },
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Install the SDK and show a consent banner.",
    source: "packages/docs/content/getting-started.md",
  },
  {
    slug: "connected-backend",
    title: "Connect to CookieChimp",
    description:
      "Load dashboard configuration and deliver consent records to CookieChimp.",
    source: "packages/docs/content/connected-backend.md",
  },
  {
    slug: "platform-ui",
    title: "Banner and vendor preferences",
    description:
      "Platform JSON, category and vendor choices, themes, consent state and the playground.",
    source: "packages/docs/content/platform-ui.md",
  },
  {
    slug: "reference",
    title: "Core and React reference",
    description: "Regions, gating, Consent Mode, headless UI, GPP and TCF.",
    source: "README.md",
  },
  {
    slug: "nextjs",
    title: "Next.js",
    description: "App Router, Pages Router, connected mode and strict CSP.",
    source: "packages/nextjs/README.md",
  },
  {
    slug: "scripts",
    title: "Script presets",
    description: "Analytics and advertising presets that wait for consent.",
    source: "packages/scripts/README.md",
  },
  {
    slug: "translations",
    title: "Translations",
    description: "Per-locale banner messages and opt-in TCF labels.",
    source: "packages/docs/content/translations.md",
  },
  {
    slug: "cli",
    title: "CLI",
    description: "init, link, pull and doctor.",
    source: "packages/cli/README.md",
  },
  {
    slug: "devtools",
    title: "Devtools",
    description: "Inspect consent state, regions and blocked resources.",
    source: "packages/devtools/README.md",
  },
  {
    slug: "tokens",
    title: "Design tokens",
    description: "CSS variables and the Tailwind preset.",
    source: "packages/tokens/README.md",
  },
  {
    slug: "release-status",
    title: "Versions and deployment",
    description: "Package versions, connected deployment and optional integrations.",
    source: "packages/docs/content/deployment.md",
  },
  {
    slug: "ai-skills",
    title: "AI skills",
    description:
      "Agent skills for installation, gating, testing and connected mode.",
    source: "packages/docs/content/ai-skills.md",
  },
  {
    slug: "examples",
    title: "Examples",
    description: "Runnable Next.js and plain React/Vite apps.",
    source: "packages/docs/content/examples.md",
  },
];

export const navigation = {
  dropdown: "Consent SDK",
  icon: "code",
  description: "React, Next.js and JavaScript consent SDK",
  groups: [
    {
      group: "Get started",
      pages: [
        "sdk/overview",
        "sdk/getting-started",
        "sdk/platform-ui",
        "sdk/connected-backend",
        "sdk/examples",
        "sdk/release-status",
      ],
    },
    {
      group: "SDK reference",
      pages: [
        "sdk/reference",
        "sdk/nextjs",
        "sdk/scripts",
        "sdk/translations",
        "sdk/cli",
        "sdk/devtools",
        "sdk/tokens",
        "sdk/ai-skills",
      ],
    },
  ],
};

export const repoUrl = "https://github.com/cookiechimp/cookiechimp-sdk";
