import { describe, expect, it } from "vitest";
import { assertProvider, otherProviders } from "./providers";

describe("providers", () => {
  it("allows only Messenger, Discord, and Zalo providers", () => {
    expect(assertProvider("messenger")).toBe("messenger");
    expect(assertProvider("discord")).toBe("discord");
    expect(assertProvider("zalo")).toBe("zalo");
    expect(() => assertProvider("teams")).toThrow("Unsupported provider");
  });

  it("returns the two switch targets for an active provider", () => {
    expect(otherProviders("messenger")).toEqual(["discord", "zalo"]);
  });
});
