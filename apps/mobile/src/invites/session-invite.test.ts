import { describe, expect, it } from "vitest";
import {
  buildSessionInviteUrl,
  sessionRouteFromInviteUrl
} from "./session-invite";

describe("buildSessionInviteUrl", () => {
  it("builds a Syncthia deep link for a session participant", () => {
    expect(buildSessionInviteUrl("session-1", "user-2")).toBe(
      "syncthia://session/session-1?participantId=user-2"
    );
  });

  it("encodes session and participant ids", () => {
    expect(buildSessionInviteUrl("session one", "user/two")).toBe(
      "syncthia://session/session%20one?participantId=user%2Ftwo"
    );
  });
});

describe("sessionRouteFromInviteUrl", () => {
  it("routes Syncthia invite links to the session participant", () => {
    expect(
      sessionRouteFromInviteUrl("syncthia://session/session-1?participantId=user-2")
    ).toEqual({
      pathname: "/session/[sessionId]",
      params: {
        sessionId: "session-1",
        participantId: "user-2"
      }
    });
  });

  it("decodes invite link ids", () => {
    expect(
      sessionRouteFromInviteUrl(
        "syncthia://session/session%20one?participantId=user%2Ftwo"
      )
    ).toEqual({
      pathname: "/session/[sessionId]",
      params: {
        sessionId: "session one",
        participantId: "user/two"
      }
    });
  });

  it("supports path-style Syncthia links", () => {
    expect(
      sessionRouteFromInviteUrl("syncthia:///session/session-3?participantId=user-4")
    ).toEqual({
      pathname: "/session/[sessionId]",
      params: {
        sessionId: "session-3",
        participantId: "user-4"
      }
    });
  });

  it("ignores invalid invite links", () => {
    expect(sessionRouteFromInviteUrl("https://example.test/session/session-1")).toBeUndefined();
    expect(sessionRouteFromInviteUrl("syncthia://profile/user-1")).toBeUndefined();
    expect(sessionRouteFromInviteUrl("not a url")).toBeUndefined();
  });
});
