/** Return whether a service matcher pattern is non-empty and safe to compile. */
export function validPattern(pattern: unknown): boolean {
  if (pattern instanceof RegExp) return pattern.source !== "(?:)";
  return (
    typeof pattern === "string" && pattern.length > 0 && !/\s/.test(pattern)
  );
}
