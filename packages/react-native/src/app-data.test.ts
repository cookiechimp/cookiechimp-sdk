import { describe, expect, it } from "vitest";
import { appData, DATA_TYPES, label, PURPOSES } from "./app-data";

describe("appData", () => {
  it("keeps valid labels and drops everything else", () => {
    expect(
      appData({
        collected: ["device_id", "device_id", 3, "", "crash_data"],
        purposes: ["analytics"],
        tracking: false,
        retention: " 14 months ",
        packages: { ios: ["FirebaseAnalytics"], android: "nope" },
      }),
    ).toEqual({
      collected: ["device_id", "crash_data"],
      purposes: ["analytics"],
      tracking: false,
      retention: "14 months",
      packages: { ios: ["FirebaseAnalytics"], android: [] },
    });
  });

  it("returns undefined when there is nothing to show", () => {
    expect(appData(undefined)).toBeUndefined();
    expect(appData({ collected: [], packages: {} })).toBeUndefined();
  });

  it("labels known keys and makes unknown keys readable", () => {
    expect(label(DATA_TYPES, "advertising_id")).toBe("Advertising ID");
    expect(label(PURPOSES, "third_party_advertising")).toBe(
      "Third-party advertising",
    );
    expect(label(DATA_TYPES, "voice_prints")).toBe("Voice prints");
    expect(label(DATA_TYPES, "toString")).toBe("ToString");
  });
});
