/** Docs site pages, in navigation order. Paths are relative to the repo root. */
export interface PageSpec {
  slug: string;
  title: string;
  description: string;
  source: string;
}

export const pages: readonly PageSpec[] = [
  {
    slug: "index",
    title: "CookieChimp Consent SDK",
    description: "What the SDK is, what it ships, and where to start.",
    source: "packages/docs/content/index.md",
  },
  {
    slug: "getting-started",
    title: "Getting started",
    description:
      "Install the SDK and show a consent banner in Next.js, React or plain JavaScript.",
    source: "packages/docs/content/getting-started.md",
  },
  {
    slug: "reference",
    title: "Core and React reference",
    description:
      "Regions and regulations, script and iframe gating, Google Consent Mode v2, IAB GPP and TCF, headless primitives and network blocking.",
    source: "README.md",
  },
  {
    slug: "nextjs",
    title: "Next.js",
    description:
      "App Router and Pages Router providers, connected mode, self-hosted consent records, middleware, GPP and strict CSP.",
    source: "packages/nextjs/README.md",
  },
  {
    slug: "scripts",
    title: "Script presets",
    description:
      "GA4, GTM, Google Ads, Meta Pixel, Clarity, PostHog, Segment, Hotjar, LinkedIn and TikTok presets.",
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
    description:
      "Floating panel for consent state, region and blocked resources.",
    source: "packages/devtools/README.md",
  },
  {
    slug: "tokens",
    title: "Design tokens",
    description: "CSS variables and the Tailwind preset.",
    source: "packages/tokens/README.md",
  },
  {
    slug: "deployment",
    title: "Deployment and release status",
    description:
      "Build and validate the static docs artifact, and check launch prerequisites.",
    source: "packages/docs/content/deployment.md",
  },
  {
    slug: "ai-skills",
    title: "AI skills",
    description:
      "Agent skills for installing the banner, gating scripts, testing consent and connecting to CookieChimp.",
    source: "packages/docs/content/ai-skills.md",
  },
  {
    slug: "examples",
    title: "Examples",
    description: "Runnable Next.js App Router and Pages Router examples.",
    source: "packages/docs/content/examples.md",
  },
];

/** AI skills, published under /skills/<name>/SKILL.md. */
export const skills = [
  "install-banner",
  "gate-scripts",
  "test-consent",
  "connect-cookiechimp",
] as const;

export const repoUrl = "https://github.com/cookiechimp/cookiechimp-sdk";
