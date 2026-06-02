import { describe, expect, it } from "vitest";
import { notificationRouteFromData } from "./notification-route";

describe("notificationRouteFromData", () => {
  it("routes switch notification payloads to the session participant", () => {
    expect(
      notificationRouteFromData({
        sessionId: "session-1",
        recipientId: "u2",
        proposalId: "proposal-1"
      })
    ).toEqual({
      pathname: "/session/[sessionId]",
      params: {
        sessionId: "session-1",
        participantId: "u2"
      }
    });
  });

  it("supports legacy participantId payloads", () => {
    expect(
      notificationRouteFromData({
        sessionId: "session-2",
        participantId: "u1"
      })
    ).toEqual({
      pathname: "/session/[sessionId]",
      params: {
        sessionId: "session-2",
        participantId: "u1"
      }
    });
  });

  it("ignores payloads without a session id", () => {
    expect(notificationRouteFromData({ recipientId: "u2" })).toBeUndefined();
    expect(notificationRouteFromData(null)).toBeUndefined();
  });
});
