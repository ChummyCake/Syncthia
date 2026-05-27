import {
  CallSession,
  ProviderLaunchTarget,
  SwitchProposal
} from "@syncthia/shared";
import { WsException } from "@nestjs/websockets";
import { describe, expect, it, vi } from "vitest";
import { Socket } from "socket.io";
import { SessionEventsGateway, sessionRoomName } from "./session-events.gateway";

describe("SessionEventsGateway", () => {
  it("joins and leaves session rooms", () => {
    const gateway = new SessionEventsGateway();
    const client = createSocket();

    expect(gateway.handleJoinSession(client, { sessionId: "s1" })).toEqual({
      sessionId: "s1"
    });
    expect(client.join).toHaveBeenCalledWith("session:s1");
    expect(client.emit).toHaveBeenCalledWith("session.joined", {
      sessionId: "s1"
    });

    expect(gateway.handleLeaveSession(client, { sessionId: "s1" })).toEqual({
      sessionId: "s1"
    });
    expect(client.leave).toHaveBeenCalledWith("session:s1");
    expect(client.emit).toHaveBeenCalledWith("session.left", {
      sessionId: "s1"
    });
  });

  it("rejects invalid room payloads", () => {
    const gateway = new SessionEventsGateway();
    const client = createSocket();

    expect(() => gateway.handleJoinSession(client, {})).toThrow(WsException);
    expect(client.join).not.toHaveBeenCalled();
  });

  it("emits session events only to that session room", () => {
    const gateway = new SessionEventsGateway();
    const room = {
      emit: vi.fn()
    };
    const server = {
      to: vi.fn(() => room)
    };
    (gateway as unknown as { server: typeof server }).server = server;

    gateway.emitSessionUpdated(createSession("s1"));

    expect(server.to).toHaveBeenCalledWith("session:s1");
    expect(room.emit).toHaveBeenCalledWith("session.updated", {
      session: expect.objectContaining({ id: "s1" })
    });

    gateway.emitSessionUpdated(createSession("s1"), [
      {
        provider: "discord",
        handle: "stream-room",
        webUrl: "https://discord.gg/syncthia"
      }
    ]);

    expect(room.emit).toHaveBeenCalledWith("session.updated", {
      session: expect.objectContaining({ id: "s1" }),
      providerEndpoints: [
        {
          provider: "discord",
          handle: "stream-room",
          webUrl: "https://discord.gg/syncthia"
        }
      ]
    });
  });

  it("emits switch events only to the proposal session room", () => {
    const gateway = new SessionEventsGateway();
    const room = {
      emit: vi.fn()
    };
    const server = {
      to: vi.fn(() => room)
    };
    (gateway as unknown as { server: typeof server }).server = server;

    const proposal = createProposal("proposal-1", "s1");
    const launchTarget: ProviderLaunchTarget = {
      provider: "discord",
      label: "Discord",
      appUrl: "discord://-/channels/123/456",
      webUrl: "https://discord.gg/syncthia",
      instructions: "Open Discord and join the agreed DM, channel, or invite."
    };

    gateway.emitSwitchProposed(proposal);
    gateway.emitSwitchAccepted(proposal);
    gateway.emitSwitchRejected(proposal);
    gateway.emitSwitchLaunching(proposal, launchTarget);
    gateway.emitSwitchExpired(proposal);
    gateway.emitSwitchConfirmed(createSession("s1"), proposal);

    expect(server.to).toHaveBeenCalledTimes(6);
    expect(server.to).toHaveBeenCalledWith("session:s1");
    expect(room.emit).toHaveBeenCalledWith("switch.proposed", { proposal });
    expect(room.emit).toHaveBeenCalledWith("switch.accepted", { proposal });
    expect(room.emit).toHaveBeenCalledWith("switch.rejected", { proposal });
    expect(room.emit).toHaveBeenCalledWith("switch.launching", {
      proposal,
      launchTarget
    });
    expect(room.emit).toHaveBeenCalledWith("switch.expired", { proposal });
    expect(room.emit).toHaveBeenCalledWith("switch.confirmed", {
      session: expect.objectContaining({ id: "s1" }),
      proposal
    });
  });

  it("builds stable session room names", () => {
    expect(sessionRoomName("abc")).toBe("session:abc");
  });
});

function createSocket() {
  return {
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn()
  } as unknown as Socket;
}

function createSession(id: string): CallSession {
  const now = "2026-05-28T00:00:00.000Z";

  return {
    id,
    activeProvider: "messenger",
    participants: [
      { id: "u1", displayName: "Ava" },
      { id: "u2", displayName: "Ben" }
    ],
    createdAt: now,
    updatedAt: now
  };
}

function createProposal(id: string, sessionId: string): SwitchProposal {
  const now = "2026-05-28T00:00:00.000Z";

  return {
    id,
    sessionId,
    fromProvider: "messenger",
    toProvider: "discord",
    reason: "streaming",
    requesterId: "u1",
    recipientId: "u2",
    status: "proposed",
    acceptedBy: ["u1"],
    joinConfirmations: [],
    expiresAt: "2026-05-28T00:02:00.000Z",
    createdAt: now,
    updatedAt: now
  };
}
