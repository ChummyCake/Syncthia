import {
  Prisma,
  Provider as DbProvider,
  SwitchStatus as DbSwitchStatus
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import {
  CallSession,
  EXPIRABLE_SWITCH_STATUSES,
  Provider,
  ProviderEndpoint,
  SwitchProposal,
  SwitchStatus
} from "@syncthia/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  ProposalLookup,
  SessionsRepository,
  StoredSession
} from "./sessions.repository";

const sessionInclude = {
  participants: {
    include: { user: true },
    orderBy: { joinedAt: "asc" }
  },
  providerEndpoints: {
    orderBy: { createdAt: "asc" }
  },
  proposals: {
    include: {
      joinConfirmations: {
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.CallSessionInclude;

type PersistedSession = Prisma.CallSessionGetPayload<{
  include: typeof sessionInclude;
}>;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(storedSession: StoredSession): Promise<StoredSession> {
    return this.prisma.$transaction(async (tx) => {
      for (const participant of storedSession.session.participants) {
        await tx.user.upsert({
          where: { id: participant.id },
          update: { displayName: participant.displayName },
          create: {
            id: participant.id,
            displayName: participant.displayName
          }
        });
      }

      const createdSession = await tx.callSession.create({
        data: {
          id: storedSession.session.id,
          activeProvider: fromProvider(storedSession.session.activeProvider),
          createdAt: toDate(storedSession.session.createdAt),
          updatedAt: toDate(storedSession.session.updatedAt),
          participants: {
            create: storedSession.session.participants.map((participant) => ({
              userId: participant.id
            }))
          },
          providerEndpoints: {
            create: storedSession.providerEndpoints.map((endpoint) => ({
              provider: fromProvider(endpoint.provider),
              handle: endpoint.handle,
              appUrl: endpoint.appUrl,
              webUrl: endpoint.webUrl
            }))
          }
        },
        include: sessionInclude
      });

      return toStoredSession(createdSession);
    });
  }

  async getSession(sessionId: string): Promise<StoredSession | undefined> {
    const session = await this.loadSession(this.prisma, sessionId);
    return session ? toStoredSession(session) : undefined;
  }

  async listExpirableProposals(): Promise<ProposalLookup[]> {
    const proposals = await this.prisma.switchProposal.findMany({
      where: {
        status: {
          in: EXPIRABLE_SWITCH_STATUSES.map(fromSwitchStatus)
        }
      },
      select: { id: true },
      orderBy: { expiresAt: "asc" }
    });

    const lookups = await Promise.all(
      proposals.map((proposal) => this.getProposal(proposal.id))
    );

    return lookups.filter((lookup): lookup is ProposalLookup => Boolean(lookup));
  }

  async upsertProviderEndpoint(
    sessionId: string,
    endpoint: ProviderEndpoint
  ): Promise<StoredSession> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.callSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
        select: { id: true }
      });

      await tx.providerEndpoint.upsert({
        where: {
          sessionId_provider: {
            sessionId: session.id,
            provider: fromProvider(endpoint.provider)
          }
        },
        update: {
          handle: endpoint.handle ?? null,
          appUrl: endpoint.appUrl ?? null,
          webUrl: endpoint.webUrl ?? null
        },
        create: {
          sessionId: session.id,
          provider: fromProvider(endpoint.provider),
          handle: endpoint.handle ?? null,
          appUrl: endpoint.appUrl ?? null,
          webUrl: endpoint.webUrl ?? null
        }
      });

      const storedSession = await this.loadSession(tx, session.id);
      if (!storedSession) {
        throw new Error(`Session ${session.id} was not found.`);
      }

      return toStoredSession(storedSession);
    });
  }

  async addProposal(proposal: SwitchProposal): Promise<StoredSession> {
    await this.prisma.switchProposal.create({
      data: {
        id: proposal.id,
        sessionId: proposal.sessionId,
        fromProvider: fromProvider(proposal.fromProvider),
        toProvider: fromProvider(proposal.toProvider),
        reason: proposal.reason,
        requesterId: proposal.requesterId,
        recipientId: proposal.recipientId,
        status: fromSwitchStatus(proposal.status),
        acceptedBy: proposal.acceptedBy,
        expiresAt: toDate(proposal.expiresAt),
        createdAt: toDate(proposal.createdAt),
        updatedAt: toDate(proposal.updatedAt)
      }
    });

    return this.requireSession(proposal.sessionId);
  }

  async getProposal(proposalId: string): Promise<ProposalLookup | undefined> {
    const proposal = await this.prisma.switchProposal.findUnique({
      where: { id: proposalId },
      select: { sessionId: true }
    });

    if (!proposal) {
      return undefined;
    }

    const storedSession = await this.getSession(proposal.sessionId);
    const storedProposal = storedSession?.proposals.find(
      (candidate) => candidate.id === proposalId
    );

    if (!storedSession || !storedProposal) {
      return undefined;
    }

    return {
      storedSession,
      proposal: storedProposal
    };
  }

  async updateProposal(proposal: SwitchProposal): Promise<StoredSession> {
    await this.prisma.switchProposal.update({
      where: { id: proposal.id },
      data: {
        status: fromSwitchStatus(proposal.status),
        acceptedBy: proposal.acceptedBy,
        updatedAt: toDate(proposal.updatedAt)
      }
    });

    return this.requireSession(proposal.sessionId);
  }

  async updateSessionAndProposal(
    session: CallSession,
    proposal: SwitchProposal
  ): Promise<StoredSession> {
    return this.prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: session.id },
        data: {
          activeProvider: fromProvider(session.activeProvider),
          updatedAt: toDate(session.updatedAt)
        }
      });

      await tx.switchProposal.update({
        where: { id: proposal.id },
        data: {
          status: fromSwitchStatus(proposal.status),
          acceptedBy: proposal.acceptedBy,
          updatedAt: toDate(proposal.updatedAt)
        }
      });

      for (const userId of proposal.joinConfirmations) {
        await tx.joinConfirmation.upsert({
          where: {
            proposalId_userId: {
              proposalId: proposal.id,
              userId
            }
          },
          update: {},
          create: {
            proposalId: proposal.id,
            userId
          }
        });
      }

      const storedSession = await this.loadSession(tx, session.id);
      if (!storedSession) {
        throw new Error(`Session ${session.id} was not found.`);
      }

      return toStoredSession(storedSession);
    });
  }

  private async requireSession(sessionId: string): Promise<StoredSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} was not found.`);
    }
    return session;
  }

  private async loadSession(client: PrismaClientLike, sessionId: string) {
    return client.callSession.findUnique({
      where: { id: sessionId },
      include: sessionInclude
    });
  }
}

function toStoredSession(record: PersistedSession): StoredSession {
  return {
    session: {
      id: record.id,
      activeProvider: toProvider(record.activeProvider),
      participants: record.participants.map((participant) => ({
        id: participant.userId,
        displayName: participant.user.displayName
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    },
    providerEndpoints: record.providerEndpoints.map(toProviderEndpoint),
    proposals: record.proposals.map(toSwitchProposal)
  };
}

function toProviderEndpoint(endpoint: {
  provider: DbProvider;
  handle: string | null;
  appUrl: string | null;
  webUrl: string | null;
}): ProviderEndpoint {
  return {
    provider: toProvider(endpoint.provider),
    handle: endpoint.handle ?? undefined,
    appUrl: endpoint.appUrl ?? undefined,
    webUrl: endpoint.webUrl ?? undefined
  };
}

function toSwitchProposal(
  proposal: PersistedSession["proposals"][number]
): SwitchProposal {
  return {
    id: proposal.id,
    sessionId: proposal.sessionId,
    fromProvider: toProvider(proposal.fromProvider),
    toProvider: toProvider(proposal.toProvider),
    reason: proposal.reason,
    requesterId: proposal.requesterId,
    recipientId: proposal.recipientId,
    status: toSwitchStatus(proposal.status),
    acceptedBy: proposal.acceptedBy,
    joinConfirmations: proposal.joinConfirmations.map(
      (confirmation) => confirmation.userId
    ),
    expiresAt: proposal.expiresAt.toISOString(),
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString()
  };
}

function toProvider(provider: DbProvider): Provider {
  return provider.toLowerCase() as Provider;
}

function fromProvider(provider: Provider): DbProvider {
  return provider.toUpperCase() as DbProvider;
}

function toSwitchStatus(status: DbSwitchStatus): SwitchStatus {
  return status.toLowerCase() as SwitchStatus;
}

function fromSwitchStatus(status: SwitchStatus): DbSwitchStatus {
  return status.toUpperCase() as DbSwitchStatus;
}

function toDate(value: string): Date {
  return new Date(value);
}
