import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CallSession,
  ProviderEndpoint,
  SwitchProposal,
  acceptSwitchProposal,
  assertProvider,
  buildProviderLaunchTarget,
  confirmJoinedProvider,
  createSwitchProposal,
  expireSwitchProposal,
  rejectSwitchProposal,
  recommendProviders
} from "@syncthia/shared";
import { randomUUID } from "node:crypto";
import {
  CreateSessionDto,
  CreateSwitchProposalDto,
  ParticipantActionDto
} from "./dto";
import { NotificationsService } from "../notifications/notifications.service";
import { SessionEventsGateway } from "./session-events.gateway";

const SWITCH_TTL_MS = 2 * 60 * 1000;

interface StoredSession {
  session: CallSession;
  providerEndpoints: ProviderEndpoint[];
  proposals: SwitchProposal[];
}

@Injectable()
export class SessionsService {
  private readonly sessions = new Map<string, StoredSession>();

  constructor(
    private readonly events: SessionEventsGateway,
    private readonly notifications: NotificationsService
  ) {}

  createSession(dto: CreateSessionDto) {
    const now = new Date().toISOString();
    const activeProvider = assertProvider(dto.activeProvider);
    const participantIds = new Set<string>();
    const participants = dto.participants.map((participant) => {
      const id = participant.id ?? randomUUID();
      if (participantIds.has(id)) {
        throw new BadRequestException("Participant ids must be unique.");
      }
      participantIds.add(id);
      return {
        id,
        displayName: participant.displayName.trim()
      };
    });

    const session: CallSession = {
      id: randomUUID(),
      activeProvider,
      participants,
      createdAt: now,
      updatedAt: now
    };

    const storedSession: StoredSession = {
      session,
      providerEndpoints: dto.providerEndpoints ?? [],
      proposals: []
    };

    this.sessions.set(session.id, storedSession);
    this.events.emitSessionUpdated(session);

    return this.toSessionResponse(storedSession);
  }

  getSession(sessionId: string) {
    return this.toSessionResponse(this.getStoredSession(sessionId));
  }

  createSwitchProposal(sessionId: string, dto: CreateSwitchProposalDto) {
    const storedSession = this.getStoredSession(sessionId);

    try {
      const proposal = createSwitchProposal({
        id: randomUUID(),
        session: storedSession.session,
        toProvider: dto.toProvider,
        reason: dto.reason,
        requesterId: dto.requesterId,
        recipientId: dto.recipientId,
        now: new Date(),
        ttlMs: SWITCH_TTL_MS
      });

      storedSession.proposals.push(proposal);
      this.scheduleExpiry(proposal.id, new Date(proposal.expiresAt));
      this.events.emitSwitchProposed(proposal);
      this.notifications.queueSwitchNotification(
        proposal.recipientId,
        "switch.proposed",
        proposal
      );

      return {
        proposal,
        recommendations: recommendProviders({
          signals: this.reasonToSignals(dto.reason),
          activeProvider: storedSession.session.activeProvider
        })
      };
    } catch (error) {
      throw this.toBadRequest(error);
    }
  }

  acceptProposal(proposalId: string, dto: ParticipantActionDto) {
    const { storedSession, proposal } = this.getProposal(proposalId);

    try {
      const updatedProposal = acceptSwitchProposal(
        storedSession.session,
        proposal,
        dto.participantId,
        new Date()
      );

      this.replaceProposal(storedSession, updatedProposal);
      this.events.emitSwitchAccepted(updatedProposal);

      const launchTarget =
        updatedProposal.status === "launching"
          ? buildProviderLaunchTarget(
              updatedProposal.toProvider,
              storedSession.providerEndpoints.find(
                (candidate) => candidate.provider === updatedProposal.toProvider
              )
            )
          : undefined;

      if (launchTarget) {
        this.events.emitSwitchLaunching(updatedProposal, launchTarget);
        this.notifications.queueSwitchNotification(
          updatedProposal.requesterId,
          "switch.launching",
          updatedProposal
        );
      }

      return {
        proposal: updatedProposal,
        launchTarget
      };
    } catch (error) {
      throw this.toBadRequest(error);
    }
  }

  rejectProposal(proposalId: string, dto: ParticipantActionDto) {
    const { storedSession, proposal } = this.getProposal(proposalId);

    try {
      const updatedProposal = rejectSwitchProposal(
        storedSession.session,
        proposal,
        dto.participantId,
        new Date()
      );

      this.replaceProposal(storedSession, updatedProposal);
      this.events.emitSwitchRejected(updatedProposal);

      return { proposal: updatedProposal };
    } catch (error) {
      throw this.toBadRequest(error);
    }
  }

  confirmJoined(proposalId: string, dto: ParticipantActionDto) {
    const { storedSession, proposal } = this.getProposal(proposalId);

    try {
      const result = confirmJoinedProvider(
        storedSession.session,
        proposal,
        dto.participantId,
        new Date()
      );

      storedSession.session = result.session;
      this.replaceProposal(storedSession, result.proposal);

      if (result.proposal.status === "confirmed") {
        this.events.emitSwitchConfirmed(result.session, result.proposal);
        this.events.emitSessionUpdated(result.session);
      }

      return {
        session: result.session,
        proposal: result.proposal
      };
    } catch (error) {
      throw this.toBadRequest(error);
    }
  }

  private getStoredSession(sessionId: string) {
    const storedSession = this.sessions.get(sessionId);
    if (!storedSession) {
      throw new NotFoundException(`Session ${sessionId} was not found.`);
    }
    return storedSession;
  }

  private getProposal(proposalId: string) {
    for (const storedSession of this.sessions.values()) {
      const proposal = storedSession.proposals.find((candidate) => candidate.id === proposalId);
      if (proposal) {
        return { storedSession, proposal };
      }
    }

    throw new NotFoundException(`Switch proposal ${proposalId} was not found.`);
  }

  private replaceProposal(storedSession: StoredSession, proposal: SwitchProposal) {
    storedSession.proposals = storedSession.proposals.map((candidate) =>
      candidate.id === proposal.id ? proposal : candidate
    );
  }

  private toSessionResponse(storedSession: StoredSession) {
    return {
      session: storedSession.session,
      providerEndpoints: storedSession.providerEndpoints,
      proposals: storedSession.proposals,
      recommendations: recommendProviders({
        signals: [],
        activeProvider: storedSession.session.activeProvider
      })
    };
  }

  private scheduleExpiry(proposalId: string, expiresAt: Date) {
    const delayMs = Math.max(0, expiresAt.getTime() - Date.now());
    const timeout = setTimeout(() => {
      try {
        const { storedSession, proposal } = this.getProposal(proposalId);
        const expiredProposal = expireSwitchProposal(proposal, new Date());
        if (expiredProposal.status === "expired" && proposal.status !== "expired") {
          this.replaceProposal(storedSession, expiredProposal);
          this.events.emitSwitchExpired(expiredProposal);
          this.notifications.queueSwitchNotification(
            expiredProposal.requesterId,
            "switch.expired",
            expiredProposal
          );
        }
      } catch {
        return;
      }
    }, delayMs);

    (timeout as unknown as { unref?: () => void }).unref?.();
  }

  private reasonToSignals(reason: string) {
    const normalized = reason.toLowerCase();
    return [
      normalized.includes("stream") ? "streaming" : undefined,
      normalized.includes("game") ? "gaming" : undefined,
      normalized.includes("group") ? "group" : undefined,
      normalized.includes("long") ? "long_call" : undefined,
      normalized.includes("zalo") || normalized.includes("vietnam") ? "zalo_first" : undefined,
      normalized.includes("simple") ? "simple" : undefined
    ].filter(Boolean) as Parameters<typeof recommendProviders>[0]["signals"];
  }

  private toBadRequest(error: unknown) {
    if (error instanceof BadRequestException) {
      return error;
    }

    return new BadRequestException(error instanceof Error ? error.message : "Invalid request.");
  }
}
