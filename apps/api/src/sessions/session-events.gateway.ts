import {
  CallSession,
  ProviderLaunchTarget,
  SwitchProposal
} from "@syncthia/shared";
import {
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({
  cors: true,
  namespace: "sessions"
})
export class SessionEventsGateway {
  @WebSocketServer()
  private server?: Server;

  emitSessionUpdated(session: CallSession) {
    this.emit("session.updated", { session });
  }

  emitSwitchProposed(proposal: SwitchProposal) {
    this.emit("switch.proposed", { proposal });
  }

  emitSwitchAccepted(proposal: SwitchProposal) {
    this.emit("switch.accepted", { proposal });
  }

  emitSwitchRejected(proposal: SwitchProposal) {
    this.emit("switch.rejected", { proposal });
  }

  emitSwitchLaunching(proposal: SwitchProposal, launchTarget: ProviderLaunchTarget) {
    this.emit("switch.launching", { proposal, launchTarget });
  }

  emitSwitchConfirmed(session: CallSession, proposal: SwitchProposal) {
    this.emit("switch.confirmed", { session, proposal });
  }

  emitSwitchExpired(proposal: SwitchProposal) {
    this.emit("switch.expired", { proposal });
  }

  private emit(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }
}
