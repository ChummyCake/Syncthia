import { describe, expect, it } from "vitest";
import { recommendProviders } from "./recommendations";

describe("recommendProviders", () => {
  it("ranks Discord first for streaming", () => {
    const [top] = recommendProviders({ signals: ["streaming"] });
    expect(top.provider).toBe("discord");
  });

  it("ranks Messenger first for long simple calls", () => {
    const [top] = recommendProviders({ signals: ["long_call", "simple"] });
    expect(top.provider).toBe("messenger");
  });

  it("ranks Zalo first for Zalo-first Vietnam contacts", () => {
    const [top] = recommendProviders({ signals: ["vietnam", "zalo_first"] });
    expect(top.provider).toBe("zalo");
  });
});
