export const isDev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function fail(message: string, warning = message): void {
  if (isDev()) throw new TypeError(message);
  console.warn(warning);
}
