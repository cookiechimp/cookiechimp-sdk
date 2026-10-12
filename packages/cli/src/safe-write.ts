import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { CliError } from "./project";

const inside = (root: string, target: string) => {
  const rel = relative(root, target);
  return (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  );
};

/**
 * Resolve a scaffold path and make sure it, and every existing parent, stays
 * inside the project root after following symlinks.
 */
export function safePath(root: string, file: string): string {
  if (isAbsolute(file) || file.split(/[\\/]/).includes(".."))
    throw new CliError(`Refusing to write outside the project: ${file}`);
  const realRoot = realpathSync(root);
  const target = resolve(realRoot, file);
  if (!inside(realRoot, target))
    throw new CliError(`Refusing to write outside the project: ${file}`);
  let parent = dirname(target);
  while (!existsSync(parent)) parent = dirname(parent);
  if (!inside(realRoot, realpathSync(parent)))
    throw new CliError(
      `Refusing to write through a link that leaves the project: ${file}`,
    );
  if (isLink(target))
    throw new CliError(`Refusing to overwrite a symbolic link: ${file}`);
  return target;
}

const isLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

export type WriteResult = "written" | "skipped" | "overwritten";

/** Write a new file. Existing files are kept unless force is set. */
export function safeWrite(
  root: string,
  file: string,
  content: string,
  { force = false, dryRun = false } = {},
): WriteResult {
  const target = safePath(root, file);
  const exists = existsSync(target);
  if (exists && !force) return "skipped";
  if (!dryRun) {
    mkdirSync(dirname(target), { recursive: true });
    // "wx" fails if something appeared since the check, so nothing is clobbered by a race.
    writeFileSync(target, content, { flag: exists ? "w" : "wx" });
  }
  return exists ? "overwritten" : "written";
}
