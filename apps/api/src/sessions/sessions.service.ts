import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import {
  CallSession,
  Provider,
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
  ParticipantActionDto,
  UpdateProviderEndpointDto
} from "./dto";
import { NotificationsService } from "../notifications/notifications.service";
import { SessionEventsGateway } from "./session-events.gateway";
import {
  SESSIONS_REPOSITORY,
  SessionsRepository,
  StoredSession
} from "./sessions.repository";

const SWITCH_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly events: SessionEventsGateway,
    private readonly notifications: NotificationsService,
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository
  ) {}

  async onModuleInit() {
    await this.restoreProposalExpiryTimers();
  }

  onModuleDestroy() {
    for (const timeout of this.expiryTimers.values()) {
      clearTimeout(timeout);
    }
    this.expiryTimers.clear();
  }

  async createSession(dto: CreateSessionDto) {
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
      providerEndpoints: (dto.providerEndpoints ?? []).map((endpoint) =>
        this.normalizeProviderEndpoint(endpoint)
      ),
      proposals: []
    };

    const persistedSession = await this.sessionsRepository.createSession(storedSession);
    this.events.emitSessionUpdated(
      persistedSession.session,
      persistedSession.providerEndpoints
    );

    return this.toSessionResponse(persistedSession);
  }

  async getSession(sessionId: string) {
    return this.toSessionResponse(await this.getStoredSession(sessionId));
  }

  async updateProviderEndpoint(
    sessionId: string,
    providerInput: Provider,
    dto: UpdateProviderEndpointDto
  ) {
    let provider: Provider;
    try {
      provider = assertProvider(providerInput);
    } catch (error) {
      throw this.toBadRequest(error);
    }

    await this.getStoredSession(sessionId);
    const endpoint = this.normalizeProviderEndpoint({
      provider,
      handle: dto.handle,
      appUrl: dto.appUrl,
      webUrl: dto.webUrl
    });
    const storedSession = await this.sessionsRepository.upsertProviderEndpoint(
      sessionId,
      endpoint
    );

    this.events.emitSessionUpdated(
      storedSession.session,
      storedSession.providerEndpoints
    );

    return this.toSessionResponse(storedSession);
  }

  async createSwitchProposal(sessionId: string, dto: CreateSwitchProposalDto) {
    const storedSession = await this.getStoredSession(sessionId);

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

      await this.sessionsRepository.addProposal(proposal);
      this.scheduleExpiry(proposal.id, new Date(proposal.expiresAt));
      this.events.emitSwitchProposed(proposal);
      await this.notifications.queueSwitchNotification(
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

  async acceptProposal(proposalId: string, dto: ParticipantActionDto) {
    const { storedSession, proposal } = await this.getProposal(proposalId);

    try {
      const updatedProposal = acceptSwitchProposal(
        storedSession.session,
        proposal,
        dto.participantId,
        new Date()
      );

      await this.sessionsRepository.updateProposal(updatedProposal);
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
        await this.notifications.queueSwitchNotification(
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

  async rejectProposal(proposalId: string, dto: ParticipantActionDto) {
    const { storedSession, proposal } = await this.getProposal(proposalId);

    try {
      const updatedProposal = rejectSwitchProposal(
        storedSession.session,
        proposal,
        dto.participantId,
        new Date()
      );

      await this.sessionsRepository.updateProposal(updatedProposal);
      this.clearExpiryTimer(updatedProposal.id);
      this.events.emitSwitchRejected(updatedProposal);

      return { proposal: updatedProposal };
    } catch (error) {
      throw this.toBadRequest(error);
    }
  }

  async confirmJoined(proposalId: string, dto: ParticipantActionDto) {
    const { storedSession, proposal } = await this.getProposal(proposalId);

    try {
      const result = confirmJoinedProvider(
        storedSession.session,
        proposal,
        dto.participantId,
        new Date()
      );

      await this.sessionsRepository.updateSessionAndProposal(
        result.session,
        result.proposal
      );

      if (result.proposal.status === "confirmed") {
        this.clearExpiryTimer(result.proposal.id);
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

  private async getStoredSession(sessionId: string) {
    const storedSession = await this.sessionsRepository.getSession(sessionId);
    if (!storedSession) {
      throw new NotFoundException(`Session ${sessionId} was not found.`);
    }
    return storedSession;
  }

  private async getProposal(proposalId: string) {
    const proposalLookup = await this.sessionsRepository.getProposal(proposalId);

    if (!proposalLookup) {
      throw new NotFoundException(`Switch proposal ${proposalId} was not found.`);
    }

    return proposalLookup;
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

  private normalizeProviderEndpoint(endpoint: ProviderEndpoint): ProviderEndpoint {
    return {
      provider: endpoint.provider,
      handle: this.trimOptional(endpoint.handle),
      appUrl: this.trimOptional(endpoint.appUrl),
      webUrl: this.trimOptional(endpoint.webUrl)
    };
  }

  private trimOptional(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private scheduleExpiry(proposalId: string, expiresAt: Date) {
    this.clearExpiryTimer(proposalId);
    const delayMs = Math.max(0, expiresAt.getTime() - Date.now());
    const timeout = setTimeout(() => {
      void this.expireProposal(proposalId);
    }, delayMs);

    this.expiryTimers.set(proposalId, timeout);
    (timeout as unknown as { unref?: () => void }).unref?.();
  }

  private clearExpiryTimer(proposalId: string) {
    const timeout = this.expiryTimers.get(proposalId);
    if (timeout) {
      clearTimeout(timeout);
      this.expiryTimers.delete(proposalId);
    }
  }

  private async restoreProposalExpiryTimers() {
    const activeProposals = await this.sessionsRepository.listExpirableProposals();
    const now = Date.now();

    for (const { proposal } of activeProposals) {
      const expiresAt = new Date(proposal.expiresAt);
      if (expiresAt.getTime() <= now) {
        await this.expireProposal(proposal.id);
      } else {
        this.scheduleExpiry(proposal.id, expiresAt);
      }
    }
  }

  private async expireProposal(proposalId: string) {
    this.clearExpiryTimer(proposalId);

    try {
      const { proposal } = await this.getProposal(proposalId);
      const expiredProposal = expireSwitchProposal(proposal, new Date());
      if (expiredProposal.status === "expired" && proposal.status !== "expired") {
        await this.sessionsRepository.updateProposal(expiredProposal);
        this.events.emitSwitchExpired(expiredProposal);
        await this.notifications.queueSwitchNotification(
          expiredProposal.requesterId,
          "switch.expired",
          expiredProposal
        );
      }
    } catch {
      return;
    }
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
