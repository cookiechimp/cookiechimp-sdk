import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Every `@cookiechimp/*` import in docs, skills and examples must name a real
// package export, and every imported name must be exported by its built types.
// Runs after `turbo run build` in test:unit, so dist/ exists.
const root = resolve(import.meta.dirname, "..");

async function files(): Promise<string[]> {
  const out = ["README.md"];
  for (const dir of ["packages", "skills"]) {
    for (const name of await readdir(join(root, dir))) {
      for (const candidate of [
        `${dir}/${name}/README.md`,
        `${dir}/${name}/SKILL.md`,
      ])
        try {
          await readFile(join(root, candidate));
          out.push(candidate);
        } catch {}
    }
  }
  for (const page of await readdir(join(root, "packages/docs/content")))
    out.push(`packages/docs/content/${page}`);
  return out;
}

async function exampleSources(): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(join(root, dir), {
      withFileTypes: true,
    })) {
      if ([".next", "node_modules"].includes(entry.name)) continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (/\.tsx?$/.test(entry.name)) out.push(path);
    }
  };
  await walk("examples");
  return out;
}

const fence = /```(?:ts|tsx|js|jsx)\n([\s\S]*?)```/g;
const importStatement =
  /import\s+(type\s+)?([^;]*?)\s+from\s+["'](@cookiechimp\/[^"']+)["']/g;

interface ImportUse {
  file: string;
  specifier: string;
  names: string[];
}

function importsIn(code: string, file: string): ImportUse[] {
  const uses: ImportUse[] = [];
  for (const [, , clause = "", specifier = ""] of code.matchAll(
    importStatement,
  )) {
    const named = /\{([\s\S]*)\}/.exec(clause)?.[1] ?? "";
    const names = named
      .split(",")
      .map(
        (part) =>
          part
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0] ?? "",
      )
      .filter(Boolean);
    if (/^[A-Za-z_$][\w$]*(?:\s*,|\s*$)/.test(clause.trim()))
      names.unshift("default");
    uses.push({ file, specifier, names });
  }
  for (const [, specifier = ""] of code.matchAll(
    /import\s*["'](@cookiechimp\/[^"']+)["']/g,
  ))
    uses.push({ file, specifier, names: [] });
  return uses;
}

async function exportedNames(
  specifier: string,
): Promise<Set<string> | "css" | null> {
  const [, name = "", ...rest] = specifier.split("/");
  const manifest = JSON.parse(
    await readFile(join(root, "packages", name, "package.json"), "utf8"),
  ) as { exports: Record<string, string | { types?: string }> };
  const target = manifest.exports[rest.length ? `./${rest.join("/")}` : "."];
  if (!target) return null;
  if (typeof target === "string") return target.endsWith(".css") ? "css" : null;
  if (!target.types) return null;
  const types = await readFile(
    join(root, "packages", name, target.types),
    "utf8",
  );
  const names = new Set<string>();
  for (const [, list = ""] of types.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of list.split(",")) {
      const alias = part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/);
      const exported = (alias[1] ?? alias[0] ?? "").trim();
      if (exported) names.add(exported);
    }
  for (const [, id = ""] of types.matchAll(
    /export\s+(?:declare\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g,
  ))
    names.add(id);
  if (/export\s+default\b|as default\b/.test(types)) names.add("default");
  return names;
}

describe("docs snippets", () => {
  it("parses named, aliased, type and default imports", () => {
    expect(
      importsIn(
        'import a, { b, type C, d as e } from "@cookiechimp/core";\nimport type { F } from "@cookiechimp/react/ui";',
        "x",
      ),
    ).toEqual([
      {
        file: "x",
        specifier: "@cookiechimp/core",
        names: ["default", "b", "C", "d"],
      },
      { file: "x", specifier: "@cookiechimp/react/ui", names: ["F"] },
    ]);
  });

  it("checks side-effect imports without swallowing later declarations", () => {
    expect(
      importsIn(
        'import "@cookiechimp/react/styles.css";\nimport en from "@cookiechimp/translations/en";',
        "x",
      ),
    ).toEqual([
      {
        file: "x",
        specifier: "@cookiechimp/translations/en",
        names: ["default"],
      },
      { file: "x", specifier: "@cookiechimp/react/styles.css", names: [] },
    ]);
  });

  it("detects missing subpaths and names", async () => {
    expect(await exportedNames("@cookiechimp/core/nope")).toBeNull();
    const react = await exportedNames("@cookiechimp/react");
    expect(react).toBeInstanceOf(Set);
    expect((react as Set<string>).has("ConsentProvider")).toBe(true);
    expect((react as Set<string>).has("NotAnExport")).toBe(false);
    expect(await exportedNames("@cookiechimp/react/styles.css")).toBe("css");
  });

  it("import only real package exports", async () => {
    const uses: ImportUse[] = [];
    for (const file of await files()) {
      const text = await readFile(join(root, file), "utf8");
      for (const [, code = ""] of text.matchAll(fence))
        uses.push(...importsIn(code, file));
    }
    for (const file of await exampleSources())
      uses.push(...importsIn(await readFile(join(root, file), "utf8"), file));
    expect(uses.length).toBeGreaterThan(40);
    const problems: string[] = [];
    for (const use of uses) {
      const names = await exportedNames(use.specifier);
      if (names === null) {
        problems.push(`${use.file}: ${use.specifier} is not a package export`);
        continue;
      }
      if (names === "css") continue;
      for (const name of use.names)
        if (!names.has(name))
          problems.push(`${use.file}: ${use.specifier} has no export ${name}`);
    }
    expect(problems).toEqual([]);
  });
});
