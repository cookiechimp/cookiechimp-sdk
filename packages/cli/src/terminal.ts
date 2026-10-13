import { createInterface } from "node:readline/promises";
import type { RemoteIo } from "./remote";

/** Real process access for link and pull: env, stdin and an interactive prompt. */
export function terminalIo(): RemoteIo {
  return {
    env: process.env,
    prompt: process.stdin.isTTY
      ? async (question) => {
          const rl = createInterface({
            input: process.stdin,
            output: process.stderr,
          });
          try {
            return await rl.question(question);
          } finally {
            rl.close();
          }
        }
      : undefined,
    stdin: async () => {
      let text = "";
      for await (const chunk of process.stdin) {
        text += chunk;
        if (text.length > 4096) break;
      }
      return text;
    },
  };
}
