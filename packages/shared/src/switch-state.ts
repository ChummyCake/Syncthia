import { Provider, assertProvider } from "./providers";

export const SWITCH_STATUSES = [
  "proposed",
  "accepted",
  "rejected",
  "launching",
  "confirmed",
  "expired",
  "cancelled"
] as const;

export type SwitchStatus = (typeof SWITCH_STATUSES)[number];

export interface SessionParticipant {
  id: string;
  displayName: string;
}

export interface CallSession {
  id: string;
  activeProvider: Provider;
  participants: SessionParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface SwitchProposal {
  id: string;
  sessionId: string;
  fromProvider: Provider;
  toProvider: Provider;
  reason: string;
  requesterId: string;
  recipientId: string;
  status: SwitchStatus;
  acceptedBy: string[];
  joinConfirmations: string[];
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSwitchProposalInput {
  id: string;
  session: CallSession;
  toProvider: Provider;
  reason: string;
  requesterId: string;
  recipientId: string;
  now: Date;
  ttlMs: number;
}

export function createSwitchProposal(input: CreateSwitchProposalInput): SwitchProposal {
  const toProvider = assertProvider(input.toProvider);

  if (toProvider === input.session.activeProvider) {
    throw new Error("Switch proposal must target a different provider.");
  }

  ensureParticipant(input.session, input.requesterId);
  ensureParticipant(input.session, input.recipientId);

  if (input.requesterId === input.recipientId) {
    throw new Error("Requester and recipient must be different participants.");
  }

  const now = input.now.toISOString();
  return {
    id: input.id,
    sessionId: input.session.id,
    fromProvider: input.session.activeProvider,
    toProvider,
    reason: input.reason.trim(),
    requesterId: input.requesterId,
    recipientId: input.recipientId,
    status: "proposed",
    acceptedBy: [input.requesterId],
    joinConfirmations: [],
    expiresAt: new Date(input.now.getTime() + input.ttlMs).toISOString(),
    createdAt: now,
    updatedAt: now
  };
}

export function acceptSwitchProposal(
  session: CallSession,
  proposal: SwitchProposal,
  participantId: string,
  now: Date
): SwitchProposal {
  ensureParticipant(session, participantId);
  ensureMutableProposal(proposal, now);

  const acceptedBy = unique([...proposal.acceptedBy, participantId]);
  const requiredParticipantIds = session.participants.map((participant) => participant.id);
  const allAccepted = requiredParticipantIds.every((id) => acceptedBy.includes(id));

  return {
    ...proposal,
    acceptedBy,
    status: allAccepted ? "launching" : "accepted",
    updatedAt: now.toISOString()
  };
}

export function rejectSwitchProposal(
  session: CallSession,
  proposal: SwitchProposal,
  participantId: string,
  now: Date
): SwitchProposal {
  ensureParticipant(session, participantId);
  ensureMutableProposal(proposal, now);

  return {
    ...proposal,
    status: "rejected",
    updatedAt: now.toISOString()
  };
}

export function confirmJoinedProvider(
  session: CallSession,
  proposal: SwitchProposal,
  participantId: string,
  now: Date
): { session: CallSession; proposal: SwitchProposal } {
  ensureParticipant(session, participantId);

  if (proposal.status !== "launching") {
    throw new Error(`Cannot confirm joined while proposal is ${proposal.status}.`);
  }

  const joinConfirmations = unique([...proposal.joinConfirmations, participantId]);
  const requiredParticipantIds = session.participants.map((participant) => participant.id);
  const allConfirmed = requiredParticipantIds.every((id) => joinConfirmations.includes(id));

  const updatedProposal: SwitchProposal = {
    ...proposal,
    joinConfirmations,
    status: allConfirmed ? "confirmed" : proposal.status,
    updatedAt: now.toISOString()
  };

  const updatedSession: CallSession = allConfirmed
    ? {
        ...session,
        activeProvider: proposal.toProvider,
        updatedAt: now.toISOString()
      }
    : session;

  return {
    session: updatedSession,
    proposal: updatedProposal
  };
}

export function expireSwitchProposal(proposal: SwitchProposal, now: Date): SwitchProposal {
  if (!["proposed", "accepted", "launching"].includes(proposal.status)) {
    return proposal;
  }

  if (new Date(proposal.expiresAt).getTime() > now.getTime()) {
    return proposal;
  }

  return {
    ...proposal,
    status: "expired",
    updatedAt: now.toISOString()
  };
}

function ensureMutableProposal(proposal: SwitchProposal, now: Date): void {
  const expired = expireSwitchProposal(proposal, now);
  if (expired.status === "expired") {
    throw new Error("Switch proposal has expired.");
  }

  if (!["proposed", "accepted", "launching"].includes(proposal.status)) {
    throw new Error(`Switch proposal is already ${proposal.status}.`);
  }
}

function ensureParticipant(session: CallSession, participantId: string): void {
  if (!session.participants.some((participant) => participant.id === participantId)) {
    throw new Error(`Participant ${participantId} is not in session ${session.id}.`);
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
