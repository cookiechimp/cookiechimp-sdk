import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tokens } from "../dist/index.mjs";

const kebab = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replaceAll(".", "-")
    .toLowerCase();
const flatten = (value, path = [], result = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const next = [...path, kebab(key)];
    if (typeof child === "string") result[next.join("-")] = child;
    else flatten(child, next, result);
  }
  return result;
};
const declarations = (values) =>
  Object.entries(values)
    .map(([name, value]) => `  --cc-${name}: ${value};`)
    .join("\n");

const { light, dark, ...bannerShared } = tokens.banner;
const root = flatten({ ...tokens, banner: { ...light, ...bannerShared } });
const darkValues = flatten({ banner: dark });
const css = `/* Generated from src/tokens.ts. Do not edit. */\n:root {\n${declarations(root)}\n}\n\n.cc-dark,\n[data-cc-theme="dark"] {\n${declarations(darkValues)}\n}\n`;

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/tokens.css", import.meta.url), css);
await writeFile(
  new URL("../dist/tokens.json", import.meta.url),
  `${JSON.stringify(tokens, null, 2)}\n`,
);

for (const name of ["index", "tailwind"]) {
  const source = new URL(`../dist/${name}.d.mts`, import.meta.url);
  await writeFile(
    new URL(`../dist/${name}.d.ts`, import.meta.url),
    await readFile(source),
  );
}
