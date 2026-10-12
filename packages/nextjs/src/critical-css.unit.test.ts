import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { criticalCss } from "./critical-css.generated";

type Rule = { context: string[]; text: string };

async function readGeneratedTokens(): Promise<string> {
  const url = new URL("../../tokens/dist/tokens.css", import.meta.url);
  for (let attempt = 0; attempt < 1_000; attempt++) {
    try {
      return await readFile(url, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("tokens.css was not generated");
}

function rules(source: string, context: string[] = []): Rule[] {
  const result: Rule[] = [];
  let start = 0;
  while (start < source.length) {
    const open = source.indexOf("{", start);
    if (open < 0) break;
    let depth = 1;
    let close = open + 1;
    for (; close < source.length && depth; close++) {
      if (source[close] === "{") depth++;
      else if (source[close] === "}") depth--;
    }
    const prelude = source
      .slice(start, open)
      .trim()
      .replace(/^.*;/s, "")
      .trim();
    const body = source.slice(open + 1, close - 1);
    if (prelude.startsWith("@"))
      result.push(...rules(body, [...context, prelude]));
    else
      result.push({
        context,
        text: `${prelude}{${body}}`.replace(/\s+/g, " "),
      });
    start = close;
  }
  return result;
}

describe("generated critical CSS", () => {
  it("keeps every rule verbatim under the same at-rule context", async () => {
    const [tokens, react] = await Promise.all([
      readGeneratedTokens(),
      readFile(new URL("../../react/styles.css", import.meta.url), "utf8"),
    ]);
    const fullSheet = `${tokens}\n${react}`.replace(/\/\*[\s\S]*?\*\//g, "");
    const fullRules = rules(fullSheet).map((rule) => JSON.stringify(rule));
    const generatedRules = rules(criticalCss);
    expect(generatedRules.length).toBeGreaterThan(0);
    for (const rule of generatedRules)
      expect(fullRules).toContain(JSON.stringify(rule));
    expect(generatedRules).toContainEqual(
      expect.objectContaining({ context: ["@media (max-width: 640px)"] }),
    );
  });
});
