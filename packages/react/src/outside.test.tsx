import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Banner } from "./headless";
import { useConsent } from "./index";

function Outside() {
  return <span>{useConsent().categories.necessary ? "safe" : "unsafe"}</span>;
}

it("throws a clear error outside the provider in development", () => {
  expect(() => renderToString(<Outside />)).toThrow(/ConsentProvider/);
});

it("warns and returns an inert state outside the provider in production", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(renderToString(<Outside />)).toContain("safe");
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("ConsentProvider"));
  warn.mockRestore();
  process.env.NODE_ENV = previous;
});

it("guards headless parts used outside their root", () => {
  expect(() => renderToString(<Banner.Title>Cookies</Banner.Title>)).toThrow(
    /within its Root/,
  );
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(renderToString(<Banner.Title>Cookies</Banner.Title>)).toContain(
    "Cookies",
  );
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("within its Root"));
  warn.mockRestore();
  process.env.NODE_ENV = previous;
});
