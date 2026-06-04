import { Body, Controller, Get, Ip, Param, Patch, Post } from "@nestjs/common";
import {
  CreateSessionDto,
  CreateSwitchProposalDto,
  ParticipantActionDto,
  UpdateProviderEndpointDto
} from "./dto";
import { Provider } from "@syncthia/shared";
import { RateLimitService } from "../rate-limit/rate-limit.service";
import { SessionsService } from "./sessions.service";

const CREATE_SESSION_LIMIT = {
  name: "sessions.create",
  limit: 20,
  windowMs: 60_000
};
const SWITCH_PROPOSAL_LIMIT = {
  name: "switch.propose",
  limit: 12,
  windowMs: 60_000
};
const SWITCH_ACTION_LIMIT = {
  name: "switch.action",
  limit: 40,
  windowMs: 60_000
};

@Controller()
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly rateLimits: RateLimitService
  ) {}

  @Post("sessions")
  createSession(@Body() dto: CreateSessionDto, @Ip() ip: string) {
    this.rateLimits.assertAllowed(clientKey(ip), CREATE_SESSION_LIMIT);
    return this.sessionsService.createSession(dto);
  }

  @Get("sessions/:sessionId")
  getSession(@Param("sessionId") sessionId: string) {
    return this.sessionsService.getSession(sessionId);
  }

  @Patch("sessions/:sessionId/provider-endpoints/:provider")
  updateProviderEndpoint(
    @Param("sessionId") sessionId: string,
    @Param("provider") provider: Provider,
    @Body() dto: UpdateProviderEndpointDto
  ) {
    return this.sessionsService.updateProviderEndpoint(sessionId, provider, dto);
  }

  @Post("sessions/:sessionId/switch-proposals")
  createSwitchProposal(
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateSwitchProposalDto
  ) {
    this.rateLimits.assertAllowed(
      participantKey(dto.requesterId),
      SWITCH_PROPOSAL_LIMIT
    );
    return this.sessionsService.createSwitchProposal(sessionId, dto);
  }

  @Post("switch-proposals/:proposalId/accept")
  acceptProposal(
    @Param("proposalId") proposalId: string,
    @Body() dto: ParticipantActionDto
  ) {
    this.rateLimits.assertAllowed(participantKey(dto.participantId), SWITCH_ACTION_LIMIT);
    return this.sessionsService.acceptProposal(proposalId, dto);
  }

  @Post("switch-proposals/:proposalId/reject")
  rejectProposal(
    @Param("proposalId") proposalId: string,
    @Body() dto: ParticipantActionDto
  ) {
    this.rateLimits.assertAllowed(participantKey(dto.participantId), SWITCH_ACTION_LIMIT);
    return this.sessionsService.rejectProposal(proposalId, dto);
  }

  @Post("switch-proposals/:proposalId/confirm-joined")
  confirmJoined(
    @Param("proposalId") proposalId: string,
    @Body() dto: ParticipantActionDto
  ) {
    this.rateLimits.assertAllowed(participantKey(dto.participantId), SWITCH_ACTION_LIMIT);
    return this.sessionsService.confirmJoined(proposalId, dto);
  }
}

function clientKey(ip: string) {
  return `ip:${ip || "unknown"}`;
}

function participantKey(participantId: string) {
  return `participant:${participantId}`;
}
