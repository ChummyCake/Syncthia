import { describe, expect, it } from "vitest";
import {
  CallSession,
  acceptSwitchProposal,
  confirmJoinedProvider,
  createSwitchProposal
} from "./switch-state";

const session: CallSession = {
  id: "session-1",
  activeProvider: "messenger",
  participants: [
    { id: "u1", displayName: "Ava" },
    { id: "u2", displayName: "Ben" }
  ],
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:00:00.000Z"
};

describe("switch state machine", () => {
  it("prevents switching to the active provider", () => {
    expect(() =>
      createSwitchProposal({
        id: "proposal-1",
        session,
        toProvider: "messenger",
        reason: "same",
        requesterId: "u1",
        recipientId: "u2",
        now: new Date("2026-05-23T00:00:00.000Z"),
        ttlMs: 60_000
      })
    ).toThrow("different provider");
  });

  it("requires both users to accept before launch and confirm before session switch", () => {
    const proposal = createSwitchProposal({
      id: "proposal-1",
      session,
      toProvider: "discord",
      reason: "streaming",
      requesterId: "u1",
      recipientId: "u2",
      now: new Date("2026-05-23T00:00:00.000Z"),
      ttlMs: 60_000
    });

    expect(proposal.status).toBe("proposed");
    expect(proposal.acceptedBy).toEqual(["u1"]);

    const accepted = acceptSwitchProposal(
      session,
      proposal,
      "u2",
      new Date("2026-05-23T00:00:10.000Z")
    );

    expect(accepted.status).toBe("launching");

    const firstConfirmation = confirmJoinedProvider(
      session,
      accepted,
      "u1",
      new Date("2026-05-23T00:00:20.000Z")
    );

    expect(firstConfirmation.session.activeProvider).toBe("messenger");
    expect(firstConfirmation.proposal.status).toBe("launching");

    const secondConfirmation = confirmJoinedProvider(
      firstConfirmation.session,
      firstConfirmation.proposal,
      "u2",
      new Date("2026-05-23T00:00:30.000Z")
    );

    expect(secondConfirmation.session.activeProvider).toBe("discord");
    expect(secondConfirmation.proposal.status).toBe("confirmed");
  });

  it("blocks join confirmation before all participants have accepted", () => {
    const proposal = createSwitchProposal({
      id: "proposal-2",
      session,
      toProvider: "zalo",
      reason: "Zalo-first contact",
      requesterId: "u1",
      recipientId: "u2",
      now: new Date("2026-05-23T00:00:00.000Z"),
      ttlMs: 60_000
    });

    expect(() =>
      confirmJoinedProvider(
        session,
        proposal,
        "u1",
        new Date("2026-05-23T00:00:05.000Z")
      )
    ).toThrow("Cannot confirm joined");
  });
});
