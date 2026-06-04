import { describe, expect, it } from "vitest";
import {
  assertProviderEndpointUrl,
  buildProviderLaunchTarget
} from "./provider-launch";

describe("provider launch targets", () => {
  it("builds provider defaults when endpoint URLs are missing", () => {
    expect(buildProviderLaunchTarget("messenger").webUrl).toBe(
      "https://www.messenger.com/"
    );
    expect(buildProviderLaunchTarget("discord").webUrl).toBe(
      "https://discord.com/channels/@me"
    );
    expect(buildProviderLaunchTarget("zalo").webUrl).toBe("https://zalo.me/");
  });

  it("accepts provider app URLs and https web URLs", () => {
    expect(
      assertProviderEndpointUrl(
        "discord",
        "appUrl",
        " discord://-/channels/123/456 "
      )
    ).toBe("discord://-/channels/123/456");
    expect(
      assertProviderEndpointUrl(
        "messenger",
        "appUrl",
        " fb-messenger://user-thread/123 "
      )
    ).toBe("fb-messenger://user-thread/123");
    expect(
      assertProviderEndpointUrl("zalo", "webUrl", " https://zalo.me/u2 ")
    ).toBe("https://zalo.me/u2");
  });

  it("rejects invalid or unsafe endpoint URL schemes", () => {
    expect(() =>
      assertProviderEndpointUrl("discord", "webUrl", "javascript:alert(1)")
    ).toThrow("Discord web URL must use https URLs.");
    expect(() =>
      assertProviderEndpointUrl("discord", "appUrl", "zalo://profile/u2")
    ).toThrow("Discord app URL must use discord, or https URLs.");
    expect(() =>
      assertProviderEndpointUrl("messenger", "appUrl", "not a url")
    ).toThrow("Messenger app URL must be a valid URL.");
  });
});
