import { Injectable } from "@nestjs/common";
import {
  CallSession,
  SwitchProposal,
  isExpirableSwitchStatus
} from "@syncthia/shared";
import {
  ProposalLookup,
  SessionsRepository,
  StoredSession
} from "./sessions.repository";

@Injectable()
export class InMemorySessionsRepository implements SessionsRepository {
  private readonly sessions = new Map<string, StoredSession>();

  async createSession(storedSession: StoredSession): Promise<StoredSession> {
    this.sessions.set(storedSession.session.id, storedSession);
    return storedSession;
  }

  async getSession(sessionId: string): Promise<StoredSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async listExpirableProposals(): Promise<ProposalLookup[]> {
    return [...this.sessions.values()]
      .flatMap((storedSession) =>
        storedSession.proposals
          .filter((proposal) => isExpirableSwitchStatus(proposal.status))
          .map((proposal) => ({ storedSession, proposal }))
      )
      .sort(
        (left, right) =>
          new Date(left.proposal.expiresAt).getTime() -
          new Date(right.proposal.expiresAt).getTime()
      );
  }

  async addProposal(proposal: SwitchProposal): Promise<StoredSession> {
    const storedSession = this.requireSession(proposal.sessionId);
    storedSession.proposals.push(proposal);
    return storedSession;
  }

  async getProposal(proposalId: string): Promise<ProposalLookup | undefined> {
    for (const storedSession of this.sessions.values()) {
      const proposal = storedSession.proposals.find(
        (candidate) => candidate.id === proposalId
      );
      if (proposal) {
        return { storedSession, proposal };
      }
    }

    return undefined;
  }

  async updateProposal(proposal: SwitchProposal): Promise<StoredSession> {
    const storedSession = this.requireSession(proposal.sessionId);
    storedSession.proposals = storedSession.proposals.map((candidate) =>
      candidate.id === proposal.id ? proposal : candidate
    );
    return storedSession;
  }

  async updateSessionAndProposal(
    session: CallSession,
    proposal: SwitchProposal
  ): Promise<StoredSession> {
    const storedSession = this.requireSession(session.id);
    storedSession.session = session;
    storedSession.proposals = storedSession.proposals.map((candidate) =>
      candidate.id === proposal.id ? proposal : candidate
    );
    return storedSession;
  }

  private requireSession(sessionId: string): StoredSession {
    const storedSession = this.sessions.get(sessionId);
    if (!storedSession) {
      throw new Error(`Session ${sessionId} was not found.`);
    }
    return storedSession;
  }
}
