import { createSwitchProposal } from "@syncthia/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsService } from "../notifications/notifications.service";
import { InMemorySessionsRepository } from "./in-memory-sessions.repository";
import { SessionEventsGateway } from "./session-events.gateway";
import { SessionsService } from "./sessions.service";
import { StoredSession } from "./sessions.repository";

function createService(repository = new InMemorySessionsRepository()) {
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
    repository,
    service: new SessionsService(
      events,
      notifications,
      repository
    )
  };
}

describe("SessionsService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("updates provider endpoint launch details", async () => {
    const { service, events } = createService();
    const created = await service.createSession({
      activeProvider: "messenger",
      participants: [
        { id: "u1", displayName: "Ava" },
        { id: "u2", displayName: "Ben" }
      ]
    });

    const updated = await service.updateProviderEndpoint(
      created.session.id,
      "discord",
      {
        handle: " stream-room ",
        appUrl: " discord://-/channels/123/456 ",
        webUrl: " https://discord.gg/syncthia "
      }
    );

    expect(updated.providerEndpoints).toEqual([
      {
        provider: "discord",
        handle: "stream-room",
        appUrl: "discord://-/channels/123/456",
        webUrl: "https://discord.gg/syncthia"
      }
    ]);
    expect(events.emitSessionUpdated).toHaveBeenLastCalledWith(
      updated.session,
      updated.providerEndpoints
    );
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

  it("expires persisted overdue proposals on startup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T01:00:02.000Z"));

    const { service, repository, events, notifications } = createService();
    const proposal = await seedProposal(repository, {
      id: "restart-overdue",
      now: new Date("2026-05-28T01:00:00.000Z"),
      ttlMs: 1_000
    });

    await service.onModuleInit();

    const lookup = await repository.getProposal(proposal.id);
    expect(lookup?.proposal.status).toBe("expired");
    expect(events.emitSwitchExpired).toHaveBeenCalledWith(
      expect.objectContaining({
        id: proposal.id,
        status: "expired"
      })
    );
    expect(notifications.queueSwitchNotification).toHaveBeenCalledWith(
      proposal.requesterId,
      "switch.expired",
      expect.objectContaining({ id: proposal.id, status: "expired" })
    );

    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it("reschedules future persisted proposals on startup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T01:00:00.000Z"));

    const { service, repository, events } = createService();
    const proposal = await seedProposal(repository, {
      id: "restart-future",
      now: new Date("2026-05-28T01:00:00.000Z"),
      ttlMs: 1_000
    });

    await service.onModuleInit();

    expect((await repository.getProposal(proposal.id))?.proposal.status).toBe(
      "proposed"
    );

    await vi.advanceTimersByTimeAsync(1_001);

    expect((await repository.getProposal(proposal.id))?.proposal.status).toBe(
      "expired"
    );
    expect(events.emitSwitchExpired).toHaveBeenCalledOnce();

    service.onModuleDestroy();
    vi.useRealTimers();
  });
});

async function seedProposal(
  repository: InMemorySessionsRepository,
  options: { id: string; now: Date; ttlMs: number }
) {
  const storedSession = createStoredSession(options.id);
  await repository.createSession(storedSession);

  const proposal = createSwitchProposal({
    id: `${options.id}-proposal`,
    session: storedSession.session,
    toProvider: "discord",
    reason: "streaming",
    requesterId: `${options.id}-u1`,
    recipientId: `${options.id}-u2`,
    now: options.now,
    ttlMs: options.ttlMs
  });
  await repository.addProposal(proposal);

  return proposal;
}

function createStoredSession(id: string): StoredSession {
  const now = "2026-05-28T00:00:00.000Z";

  return {
    session: {
      id,
      activeProvider: "messenger",
      participants: [
        { id: `${id}-u1`, displayName: "Ava" },
        { id: `${id}-u2`, displayName: "Ben" }
      ],
      createdAt: now,
      updatedAt: now
    },
    providerEndpoints: [],
    proposals: []
  };
}
