import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  CreateSessionDto,
  CreateSwitchProposalDto,
  ParticipantActionDto
} from "./dto";
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
