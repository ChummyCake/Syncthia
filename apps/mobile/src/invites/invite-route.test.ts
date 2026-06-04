import { describe, expect, it, vi } from "vitest";
import { routeInviteUrl } from "./invite-route";

describe("routeInviteUrl", () => {
  it("pushes valid Syncthia invite links", () => {
    const push = vi.fn();

    expect(
      routeInviteUrl("syncthia://session/session-1?participantId=u2", push)
    ).toBe(true);
    expect(push).toHaveBeenCalledWith({
      pathname: "/session/[sessionId]",
      params: {
        sessionId: "session-1",
        participantId: "u2"
      }
    });
  });

  it("ignores empty or invalid invite links", () => {
    const push = vi.fn();

    expect(routeInviteUrl(undefined, push)).toBe(false);
    expect(routeInviteUrl(null, push)).toBe(false);
    expect(routeInviteUrl("https://example.test/session/session-1", push)).toBe(false);
    expect(routeInviteUrl("syncthia://profile/u2", push)).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
