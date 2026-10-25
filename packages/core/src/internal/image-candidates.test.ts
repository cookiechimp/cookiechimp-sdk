import { expect, it } from "vitest";
import { imageCandidates } from "./image-candidates";

it("reads srcset URLs with density/width descriptors, trailing separators and URL commas", () => {
  expect(
    imageCandidates(" /small 320w, https://a.test/a,b 2x, /large 3x, "),
  ).toEqual(["/small", "https://a.test/a,b", "/large"]);
  expect(
    imageCandidates("data:image/png;base64,AAAA 1x, https://tracker.test/p 2x"),
  ).toEqual(["data:image/png;base64,AAAA", "https://tracker.test/p"]);
  expect(imageCandidates("/one, /two,")).toEqual(["/one", "/two"]);
  expect(imageCandidates(" , \t\n")).toEqual([]);
});
