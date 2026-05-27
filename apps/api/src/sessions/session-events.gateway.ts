import {
  CallSession,
  ProviderEndpoint,
  ProviderLaunchTarget,
  SwitchProposal
} from "@syncthia/shared";
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: true,
  namespace: "sessions"
})
export class SessionEventsGateway {
  @WebSocketServer()
  private server?: Server;

  @SubscribeMessage("session.join")
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SessionRoomPayload
  ) {
    const sessionId = this.requireSessionId(payload);
    void client.join(sessionRoomName(sessionId));
    client.emit("session.joined", { sessionId });
    return { sessionId };
  }

  @SubscribeMessage("session.leave")
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SessionRoomPayload
  ) {
    const sessionId = this.requireSessionId(payload);
    void client.leave(sessionRoomName(sessionId));
    client.emit("session.left", { sessionId });
    return { sessionId };
  }

  emitSessionUpdated(session: CallSession, providerEndpoints?: ProviderEndpoint[]) {
    this.emitToSession(session.id, "session.updated", {
      session,
      ...(providerEndpoints ? { providerEndpoints } : {})
    });
  }

  emitSwitchProposed(proposal: SwitchProposal) {
    this.emitToSession(proposal.sessionId, "switch.proposed", { proposal });
  }

  emitSwitchAccepted(proposal: SwitchProposal) {
    this.emitToSession(proposal.sessionId, "switch.accepted", { proposal });
  }

  emitSwitchRejected(proposal: SwitchProposal) {
    this.emitToSession(proposal.sessionId, "switch.rejected", { proposal });
  }

  emitSwitchLaunching(proposal: SwitchProposal, launchTarget: ProviderLaunchTarget) {
    this.emitToSession(proposal.sessionId, "switch.launching", {
      proposal,
      launchTarget
    });
  }

  emitSwitchConfirmed(session: CallSession, proposal: SwitchProposal) {
    this.emitToSession(session.id, "switch.confirmed", { session, proposal });
  }

  emitSwitchExpired(proposal: SwitchProposal) {
    this.emitToSession(proposal.sessionId, "switch.expired", { proposal });
  }

  private emitToSession(sessionId: string, event: string, payload: unknown) {
    this.server?.to(sessionRoomName(sessionId)).emit(event, payload);
  }

  private requireSessionId(payload: SessionRoomPayload) {
    if (!payload || typeof payload.sessionId !== "string" || !payload.sessionId.trim()) {
      throw new WsException("Session id is required.");
    }

    return payload.sessionId.trim();
  }
}

interface SessionRoomPayload {
  sessionId?: unknown;
}

export function sessionRoomName(sessionId: string) {
  return `session:${sessionId}`;
}
