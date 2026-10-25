import { describe, expect, it, vi } from "vitest";
import {
  parseRegistryMetadata,
  verifyRegistryPublication,
} from "./registry.ts";

const entry = {
  name: "@cookiechimp/tokens",
  version: "1.1.0",
  integrity: "sha512-reviewed",
};
const published = {
  "dist.integrity": entry.integrity,
  "dist.attestations": { url: "https://registry.npmjs.org/attestations" },
};
const missing = () =>
  Object.assign(new Error("Not visible yet"), {
    stderr: "npm error code E404",
  });

describe("exact-version npm metadata", () => {
  it("accepts npm 12's one-item array response for an already published version", () => {
    expect(parseRegistryMetadata(JSON.stringify([published]))).toEqual(
      published,
    );
  });

  it("also accepts the object response used by earlier npm versions", () => {
    expect(parseRegistryMetadata(JSON.stringify(published))).toEqual(published);
  });

  it.each([
    [],
    [published, published],
    null,
    {},
    { "dist.integrity": 123 },
    { "dist.integrity": "" },
  ])(
    "rejects ambiguous or malformed metadata without treating it as unpublished: %j",
    (value) => {
      expect(() => parseRegistryMetadata(JSON.stringify(value))).toThrow(
        "Invalid exact-version npm registry metadata",
      );
    },
  );
});

describe("registry propagation after an acknowledged publish", () => {
  it("stops polling when its elapsed-time limit is reached", async () => {
    vi.useFakeTimers();
    try {
      const read = vi.fn(() => {
        throw missing();
      });
      await expect(
        verifyRegistryPublication(entry, read, {
          timeoutMs: 100,
          wait: async (milliseconds) => {
            vi.advanceTimersByTime(milliseconds);
          },
        }),
      ).rejects.toThrow(
        "Timed out verifying published integrity and provenance",
      );
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits through temporary 404 responses before verifying the package", async () => {
    const read = vi
      .fn()
      .mockImplementationOnce(() => {
        throw missing();
      })
      .mockImplementationOnce(() => {
        throw missing();
      })
      .mockReturnValue(published);
    const wait = vi.fn(async () => {});
    await expect(
      verifyRegistryPublication(entry, read, { wait }),
    ).resolves.toEqual(published);
    expect(read).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("waits for provenance when the correct package bytes are already visible", async () => {
    const read = vi
      .fn()
      .mockReturnValueOnce({ "dist.integrity": entry.integrity })
      .mockReturnValue(published);
    await expect(
      verifyRegistryPublication(entry, read, { wait: async () => {} }),
    ).resolves.toEqual(published);
  });

  it("rejects mismatched bytes immediately", async () => {
    const read = vi.fn(() => ({
      ...published,
      "dist.integrity": "sha512-other",
    }));
    const wait = vi.fn(async () => {});
    await expect(
      verifyRegistryPublication(entry, read, { wait }),
    ).rejects.toThrow("Published integrity differs");
    expect(read).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("preserves authentication and other registry errors", async () => {
    const denied = Object.assign(new Error("Unauthorized"), {
      stderr: "npm error code E401",
    });
    const read = vi.fn(() => {
      throw denied;
    });
    await expect(
      verifyRegistryPublication(entry, read, { wait: async () => {} }),
    ).rejects.toBe(denied);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("fails within the configured bound if metadata never becomes visible", async () => {
    const read = vi.fn(() => {
      throw missing();
    });
    const wait = vi.fn(async () => {});
    await expect(
      verifyRegistryPublication(entry, read, { attempts: 3, wait }),
    ).rejects.toThrow("Timed out verifying published integrity and provenance");
    expect(read).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
