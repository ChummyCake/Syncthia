import {
  CallSession,
  ProviderEndpoint,
  ProviderRecommendation,
  SwitchProposal
} from "@syncthia/shared";
import { create } from "zustand";

interface SessionState {
  currentParticipantId?: string;
  session?: CallSession;
  providerEndpoints: ProviderEndpoint[];
  proposals: SwitchProposal[];
  recommendations: ProviderRecommendation[];
  setCurrentParticipantId: (participantId: string) => void;
  setSessionResponse: (response: {
    session: CallSession;
    providerEndpoints?: ProviderEndpoint[];
    proposals?: SwitchProposal[];
    recommendations?: ProviderRecommendation[];
  }) => void;
  upsertProposal: (proposal: SwitchProposal) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  providerEndpoints: [],
  proposals: [],
  recommendations: [],
  setCurrentParticipantId: (participantId) => set({ currentParticipantId: participantId }),
  setSessionResponse: (response) =>
    set((state) => ({
      session: response.session,
      providerEndpoints: response.providerEndpoints ?? state.providerEndpoints,
      proposals: response.proposals ?? state.proposals,
      recommendations: response.recommendations ?? state.recommendations
    })),
  upsertProposal: (proposal) =>
    set((state) => ({
      proposals: [
        proposal,
        ...state.proposals.filter((candidate) => candidate.id !== proposal.id)
      ]
    }))
}));
