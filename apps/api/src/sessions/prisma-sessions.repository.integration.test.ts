import {
  acceptSwitchProposal,
  confirmJoinedProvider,
  createSwitchProposal
} from "@syncthia/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { PrismaSessionsRepository } from "./prisma-sessions.repository";
import { StoredSession } from "./sessions.repository";

const describeDb =
  process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("PrismaSessionsRepository", () => {
  let prisma: PrismaService;
  let repository: PrismaSessionsRepository;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when RUN_DB_TESTS=1.");
    }

    prisma = new PrismaService();
    repository = new PrismaSessionsRepository(prisma);
    await prisma.$connect();
    await cleanDatabase(prisma);
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists sessions with provider endpoints", async () => {
    const storedSession = createStoredSession("persist-session");

    await repository.createSession(storedSession);
    const loaded = await repository.getSession(storedSession.session.id);

    expect(loaded?.session).toMatchObject({
      id: storedSession.session.id,
      activeProvider: "messenger"
    });
    expect(loaded?.session.participants).toEqual(
      expect.arrayContaining([
        { id: "persist-session-u1", displayName: "Ava" },
        { id: "persist-session-u2", displayName: "Ben" }
      ])
    );
    expect(loaded?.providerEndpoints).toEqual([
      {
        provider: "discord",
        handle: "syncthia-stream-room",
        appUrl: "discord://-/channels/123/456",
        webUrl: "https://discord.gg/syncthia"
      }
    ]);

    const updated = await repository.upsertProviderEndpoint(
      storedSession.session.id,
      {
        provider: "discord",
        handle: "updated-stream-room",
        appUrl: "discord://-/channels/999/888",
        webUrl: "https://discord.gg/updated"
      }
    );

    expect(updated.providerEndpoints).toEqual([
      {
        provider: "discord",
        handle: "updated-stream-room",
        appUrl: "discord://-/channels/999/888",
        webUrl: "https://discord.gg/updated"
      }
    ]);

    const added = await repository.upsertProviderEndpoint(
      storedSession.session.id,
      {
        provider: "zalo",
        handle: "84330000000",
        webUrl: "https://zalo.me/84330000000"
      }
    );

    expect(added.providerEndpoints).toEqual(
      expect.arrayContaining([
        {
          provider: "discord",
          handle: "updated-stream-room",
          appUrl: "discord://-/channels/999/888",
          webUrl: "https://discord.gg/updated"
        },
        {
          provider: "zalo",
          handle: "84330000000",
          webUrl: "https://zalo.me/84330000000"
        }
      ])
    );
  });

  it("persists proposal acceptance and join confirmations", async () => {
    const storedSession = await repository.createSession(
      createStoredSession("switch-lifecycle")
    );
    const proposal = createSwitchProposal({
      id: "switch-lifecycle-proposal",
      session: storedSession.session,
      toProvider: "discord",
      reason: "streaming",
      requesterId: "switch-lifecycle-u1",
      recipientId: "switch-lifecycle-u2",
      now: new Date("2026-05-28T01:00:00.000Z"),
      ttlMs: 120_000
    });

    await repository.addProposal(proposal);
    expect(
      (await repository.listExpirableProposals()).map(
        (lookup) => lookup.proposal.id
      )
    ).toEqual([proposal.id]);

    const proposedLookup = await repository.getProposal(proposal.id);

    expect(proposedLookup?.proposal).toMatchObject({
      status: "proposed",
      acceptedBy: ["switch-lifecycle-u1"],
      joinConfirmations: []
    });

    const acceptedProposal = acceptSwitchProposal(
      storedSession.session,
      proposedLookup!.proposal,
      "switch-lifecycle-u2",
      new Date("2026-05-28T01:00:10.000Z")
    );
    const afterAccept = await repository.updateProposal(acceptedProposal);
    const launchingProposal = requireProposal(afterAccept, proposal.id);

    expect(launchingProposal).toMatchObject({
      status: "launching",
      acceptedBy: ["switch-lifecycle-u1", "switch-lifecycle-u2"]
    });

    const firstJoin = confirmJoinedProvider(
      afterAccept.session,
      launchingProposal,
      "switch-lifecycle-u1",
      new Date("2026-05-28T01:00:20.000Z")
    );
    const afterFirstJoin = await repository.updateSessionAndProposal(
      firstJoin.session,
      firstJoin.proposal
    );
    const afterFirstJoinProposal = requireProposal(afterFirstJoin, proposal.id);

    expect(afterFirstJoin.session.activeProvider).toBe("messenger");
    expect(afterFirstJoinProposal.status).toBe("launching");
    expect(afterFirstJoinProposal.joinConfirmations).toEqual([
      "switch-lifecycle-u1"
    ]);

    const secondJoin = confirmJoinedProvider(
      afterFirstJoin.session,
      afterFirstJoinProposal,
      "switch-lifecycle-u2",
      new Date("2026-05-28T01:00:30.000Z")
    );
    await repository.updateSessionAndProposal(
      secondJoin.session,
      secondJoin.proposal
    );

    const reloaded = await repository.getSession(storedSession.session.id);
    const confirmedProposal = requireProposal(reloaded!, proposal.id);

    expect(reloaded?.session.activeProvider).toBe("discord");
    expect(confirmedProposal.status).toBe("confirmed");
    expect(confirmedProposal.joinConfirmations).toEqual([
      "switch-lifecycle-u1",
      "switch-lifecycle-u2"
    ]);
    expect(await repository.listExpirableProposals()).toEqual([]);
  });
});

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
    providerEndpoints: [
      {
        provider: "discord",
        handle: "syncthia-stream-room",
        appUrl: "discord://-/channels/123/456",
        webUrl: "https://discord.gg/syncthia"
      }
    ],
    proposals: []
  };
}

function requireProposal(storedSession: StoredSession, proposalId: string) {
  const proposal = storedSession.proposals.find(
    (candidate) => candidate.id === proposalId
  );

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} was not found.`);
  }

  return proposal;
}

async function cleanDatabase(prisma: PrismaService) {
  await prisma.joinConfirmation.deleteMany();
  await prisma.switchProposal.deleteMany();
  await prisma.providerEndpoint.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.sessionParticipant.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();
}
