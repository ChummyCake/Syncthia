import { describe, expect, it } from "vitest";
import { buildSessionInviteUrl } from "./session-invite";

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
