import {
  CallSession,
  ProviderEndpoint,
  ProviderRecommendation,
  SwitchProposal
} from "@syncthia/shared";

export interface SessionResponsePatch {
  session: CallSession;
  providerEndpoints?: ProviderEndpoint[];
  proposals?: SwitchProposal[];
  recommendations?: ProviderRecommendation[];
}

export interface SessionSocketEmitter {
  emit: (event: string, payload: unknown) => void;
}

export interface SessionSocketHandlersInput {
  sessionId: string;
  refreshSession: () => Promise<SessionResponsePatch>;
  setSessionResponse: (response: SessionResponsePatch) => void;
  upsertProposal: (proposal: SwitchProposal) => void;
}

export function createSessionSocketHandlers({
  sessionId,
  refreshSession,
  setSessionResponse,
  upsertProposal
}: SessionSocketHandlersInput) {
  let active = true;
  let refreshRequestId = 0;

  async function refreshCurrentSession() {
    const requestId = ++refreshRequestId;

    try {
      const response = await refreshSession();
      if (!active || requestId !== refreshRequestId || response.session.id !== sessionId) {
        return;
      }

      setSessionResponse(response);
    } catch {
      return;
    }
  }

  return {
    handleConnect(socket: SessionSocketEmitter) {
      socket.emit("session.join", { sessionId });
      void refreshCurrentSession();
    },
    handleSessionUpdated({
      session,
      providerEndpoints
    }: {
      session: CallSession;
      providerEndpoints?: ProviderEndpoint[];
    }) {
      if (session.id !== sessionId) {
        return;
      }

      setSessionResponse({
        session,
        ...(providerEndpoints ? { providerEndpoints } : {})
      });
    },
    handleProposal({ proposal }: { proposal: SwitchProposal }) {
      if (proposal.sessionId !== sessionId) {
        return;
      }

      upsertProposal(proposal);
    },
    handleSwitchConfirmed({
      session,
      proposal
    }: {
      session: CallSession;
      proposal: SwitchProposal;
    }) {
      if (session.id !== sessionId) {
        return;
      }

      setSessionResponse({ session });
      upsertProposal(proposal);
    },
    deactivate() {
      active = false;
      refreshRequestId += 1;
    }
  };
}
