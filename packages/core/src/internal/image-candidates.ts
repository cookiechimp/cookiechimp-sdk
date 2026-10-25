/** Read srcset URL tokens, preserving commas inside URLs (including data URLs). */
export function imageCandidates(input: string): string[] {
  const result: string[] = [];
  let at = 0;
  while (at < input.length) {
    while (/[\t\n\f\r ,]/.test(input[at] ?? "")) at++;
    const start = at;
    while (at < input.length && !/[\t\n\f\r ]/.test(input[at] ?? "")) at++;
    const url = input.slice(start, at);
    if (url) result.push(url.replace(/,+$/, ""));
    if (url.endsWith(",")) continue;
    let parentheses = 0;
    while (at < input.length) {
      const char = input[at++];
      if (char === "(") parentheses++;
      if (char === ")") parentheses--;
      if (char === "," && parentheses <= 0) break;
    }
  }
  return result;
}
