import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "../notifications/notifications.service";
import { InMemorySessionsRepository } from "./in-memory-sessions.repository";
import { SessionEventsGateway } from "./session-events.gateway";
import { SessionsService } from "./sessions.service";

function createService() {
  const events = {
    emitSessionUpdated: vi.fn(),
    emitSwitchProposed: vi.fn(),
    emitSwitchAccepted: vi.fn(),
    emitSwitchRejected: vi.fn(),
    emitSwitchLaunching: vi.fn(),
    emitSwitchConfirmed: vi.fn(),
    emitSwitchExpired: vi.fn()
  } as unknown as SessionEventsGateway;

  const notifications = {
    queueSwitchNotification: vi.fn()
  } as unknown as NotificationsService;

  return {
    events,
    notifications,
    service: new SessionsService(
      events,
      notifications,
      new InMemorySessionsRepository()
    )
  };
}

describe("SessionsService", () => {
  it("creates a session with one active provider", async () => {
    const { service } = createService();

    const response = await service.createSession({
      activeProvider: "messenger",
      participants: [
        { id: "u1", displayName: "Ava" },
        { id: "u2", displayName: "Ben" }
      ]
    });

    expect(response.session.activeProvider).toBe("messenger");
    expect(response.session.participants).toHaveLength(2);
  });

  it("switches provider only after accept and both join confirmations", async () => {
    const { service, events } = createService();
    const created = await service.createSession({
      activeProvider: "messenger",
      participants: [
        { id: "u1", displayName: "Ava" },
        { id: "u2", displayName: "Ben" }
      ]
    });

    const proposed = await service.createSwitchProposal(created.session.id, {
      requesterId: "u1",
      recipientId: "u2",
      toProvider: "discord",
      reason: "streaming"
    });

    const accepted = await service.acceptProposal(proposed.proposal.id, {
      participantId: "u2"
    });

    expect(accepted.proposal.status).toBe("launching");
    expect(accepted.launchTarget?.provider).toBe("discord");

    const firstJoin = await service.confirmJoined(proposed.proposal.id, {
      participantId: "u1"
    });

    expect(firstJoin.session.activeProvider).toBe("messenger");

    const secondJoin = await service.confirmJoined(proposed.proposal.id, {
      participantId: "u2"
    });

    expect(secondJoin.session.activeProvider).toBe("discord");
    expect(secondJoin.proposal.status).toBe("confirmed");
    expect(events.emitSwitchConfirmed).toHaveBeenCalledOnce();
  });
});
