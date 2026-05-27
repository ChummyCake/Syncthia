import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  CreateSessionDto,
  CreateSwitchProposalDto,
  ParticipantActionDto,
  UpdateProviderEndpointDto
} from "./dto";
import { Provider } from "@syncthia/shared";
import { SessionsService } from "./sessions.service";

@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post("sessions")
  createSession(@Body() dto: CreateSessionDto) {
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
    return this.sessionsService.createSwitchProposal(sessionId, dto);
  }

  @Post("switch-proposals/:proposalId/accept")
  acceptProposal(
    @Param("proposalId") proposalId: string,
    @Body() dto: ParticipantActionDto
  ) {
    return this.sessionsService.acceptProposal(proposalId, dto);
  }

  @Post("switch-proposals/:proposalId/reject")
  rejectProposal(
    @Param("proposalId") proposalId: string,
    @Body() dto: ParticipantActionDto
  ) {
    return this.sessionsService.rejectProposal(proposalId, dto);
  }

  @Post("switch-proposals/:proposalId/confirm-joined")
  confirmJoined(
    @Param("proposalId") proposalId: string,
    @Body() dto: ParticipantActionDto
  ) {
    return this.sessionsService.confirmJoined(proposalId, dto);
  }
}
