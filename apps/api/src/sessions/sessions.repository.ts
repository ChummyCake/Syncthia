import { CallSession, ProviderEndpoint, SwitchProposal } from "@syncthia/shared";

export const SESSIONS_REPOSITORY = Symbol("SESSIONS_REPOSITORY");

export interface StoredSession {
  session: CallSession;
  providerEndpoints: ProviderEndpoint[];
  proposals: SwitchProposal[];
}

export interface ProposalLookup {
  storedSession: StoredSession;
  proposal: SwitchProposal;
}

export interface SessionsRepository {
  createSession(storedSession: StoredSession): Promise<StoredSession>;
  getSession(sessionId: string): Promise<StoredSession | undefined>;
  listExpirableProposals(): Promise<ProposalLookup[]>;
  upsertProviderEndpoint(
    sessionId: string,
    endpoint: ProviderEndpoint
  ): Promise<StoredSession>;
  addProposal(proposal: SwitchProposal): Promise<StoredSession>;
  getProposal(proposalId: string): Promise<ProposalLookup | undefined>;
  updateProposal(proposal: SwitchProposal): Promise<StoredSession>;
  updateSessionAndProposal(
    session: CallSession,
    proposal: SwitchProposal
  ): Promise<StoredSession>;
}
