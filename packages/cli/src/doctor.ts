import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { dependency, detectProject, PACKAGES, type Project } from "./project";

export type CheckStatus = "pass" | "warn" | "fail";
export interface Check {
  id: string;
  status: CheckStatus;
  message: string;
}

const ENTRY_FILES = [
  "app/layout",
  "pages/_app",
  "main",
  "index",
  "App",
  "cookiechimp",
  "components/cookiechimp-provider",
  "components/cookiechimp-banner",
].flatMap((base) =>
  ["tsx", "ts", "jsx", "js", "mjs"].map((ext) => `${base}.${ext}`),
);
const HTML_FILES = ["index.html", "public/index.html"];
const MAX_BYTES = 1_000_000;
const UNGATED =
  /<script\b(?![^>]*\bdata-cc-src)[^>]*\bsrc=["'][^"']*(googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|clarity\.ms|static\.hotjar\.com|snap\.licdn\.com|analytics\.tiktok\.com|cdn\.segment\.com)/i;

/** Read a project file as text, skipping links that leave the project and oversized files. */
function readProjectFile(root: string, file: string): string | null {
  const path = join(root, file);
  try {
    if (!existsSync(path)) return null;
    const rel = relative(realpathSync(root), realpathSync(path));
    if (rel.startsWith(`..${sep}`) || rel === "..") return null;
    if (lstatSync(realpathSync(path)).size > MAX_BYTES) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

const major = (spec: string | undefined) => {
  const match = spec?.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
};

export function runDoctor(cwd: string): { project: Project; checks: Check[] } {
  const project = detectProject(cwd);
  const { pkg, framework, root, srcDir } = project;
  const checks: Check[] = [
    { id: "framework", status: "pass", message: `Detected ${framework}` },
  ];
  const missing = PACKAGES[framework].filter((name) => !dependency(pkg, name));
  checks.push(
    missing.length
      ? {
          id: "packages",
          status: "fail",
          message: `Missing ${missing.join(", ")}. Run cookiechimp init.`,
        }
      : {
          id: "packages",
          status: "pass",
          message: "CookieChimp packages are installed",
        },
  );
  const specs = new Set(
    Object.entries({ ...pkg.devDependencies, ...pkg.dependencies })
      .filter(([name]) => name.startsWith("@cookiechimp/"))
      .map(([, spec]) => spec),
  );
  if (specs.size > 1)
    checks.push({
      id: "versions",
      status: "warn",
      message: `@cookiechimp packages use different versions (${[...specs].join(", ")}); keep them in step.`,
    });
  const react = major(dependency(pkg, "react"));
  if (react !== undefined && react < 18)
    checks.push({
      id: "react",
      status: "warn",
      message: `React ${react} is below the supported 18.`,
    });
  const next = major(dependency(pkg, "next"));
  if (next !== undefined && next < 14)
    checks.push({
      id: "next",
      status: "warn",
      message: `Next.js ${next} is below the supported 14.`,
    });

  const dirs = [...new Set([srcDir, ""])];
  const configFound = dirs.some((dir) =>
    ["ts", "js", "mjs"].some(
      (ext) =>
        readProjectFile(root, join(dir, `cookiechimp.config.${ext}`)) !== null,
    ),
  );
  checks.push(
    configFound
      ? { id: "config", status: "pass", message: "Found cookiechimp.config" }
      : {
          id: "config",
          status: "warn",
          message:
            "No cookiechimp.config file; that is fine if your config lives elsewhere.",
        },
  );

  const sources = dirs.flatMap((dir) =>
    ENTRY_FILES.map((file) => readProjectFile(root, join(dir, file))).filter(
      (text): text is string => text !== null,
    ),
  );
  const wired = sources.some((text) =>
    /CookieChimpProvider|ConsentProvider|<CookieChimp\b|createConsent\(|withConsent\(/.test(
      text,
    ),
  );
  checks.push(
    wired
      ? {
          id: "provider",
          status: "pass",
          message: "A CookieChimp provider or runtime is wired up",
        }
      : {
          id: "provider",
          status: framework === "vanilla" ? "warn" : "fail",
          message:
            "No CookieChimp provider found in the app entry files. Follow the steps printed by cookiechimp init.",
        },
  );
  const html = HTML_FILES.map((file) => readProjectFile(root, file)).filter(
    (text): text is string => text !== null,
  );
  const ungated = [...sources, ...html].some((text) => UNGATED.test(text));
  checks.push(
    ungated
      ? {
          id: "ungated-scripts",
          status: "warn",
          message:
            'A tracking script is loaded with a plain src. Use type="text/plain" with data-cc-src and data-cc-category, or a @cookiechimp/scripts preset.',
        }
      : {
          id: "ungated-scripts",
          status: "pass",
          message: "No ungated tracking scripts found in entry files",
        },
  );
  return { project, checks };
}
