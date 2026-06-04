import { CallSession, ProviderEndpoint, SwitchProposal } from "@syncthia/shared";
import { describe, expect, it, vi } from "vitest";
import { createSessionSocketHandlers } from "./session-socket-handlers";

describe("createSessionSocketHandlers", () => {
  it("joins and refreshes the session on socket connect", async () => {
    const session = createSession("session-1");
    const endpoint: ProviderEndpoint = {
      provider: "discord",
      appUrl: "discord://invite/one"
    };
    const socket = { emit: vi.fn() };
    const setSessionResponse = vi.fn();
    const handlers = createSessionSocketHandlers({
      sessionId: session.id,
      refreshSession: vi.fn(async () => ({
        session,
        providerEndpoints: [endpoint],
        proposals: [],
        recommendations: []
      })),
      setSessionResponse,
      upsertProposal: vi.fn()
    });

    handlers.handleConnect(socket);

    expect(socket.emit).toHaveBeenCalledWith("session.join", {
      sessionId: session.id
    });
    await vi.waitFor(() => {
      expect(setSessionResponse).toHaveBeenCalledWith({
        session,
        providerEndpoints: [endpoint],
        proposals: [],
        recommendations: []
      });
    });
  });

  it("ignores stale refreshes after deactivation", async () => {
    const session = createSession("session-1");
    const setSessionResponse = vi.fn();
    let finishRefresh: (() => void) | undefined;
    const refreshSession = vi.fn(
      () =>
        new Promise<{
          session: CallSession;
          proposals: SwitchProposal[];
          recommendations: [];
        }>((resolve) => {
          finishRefresh = () =>
            resolve({
              session,
              proposals: [],
              recommendations: []
            });
        })
    );
    const handlers = createSessionSocketHandlers({
      sessionId: session.id,
      refreshSession,
      setSessionResponse,
      upsertProposal: vi.fn()
    });

    handlers.handleConnect({ emit: vi.fn() });
    handlers.deactivate();
    finishRefresh?.();

    await Promise.resolve();
    expect(setSessionResponse).not.toHaveBeenCalled();
  });

  it("filters session and proposal events by session id", () => {
    const session = createSession("session-1");
    const otherSession = createSession("session-2");
    const proposal = createProposal("proposal-1", session.id);
    const otherProposal = createProposal("proposal-2", otherSession.id);
    const setSessionResponse = vi.fn();
    const upsertProposal = vi.fn();
    const handlers = createSessionSocketHandlers({
      sessionId: session.id,
      refreshSession: vi.fn(async () => ({
        session,
        proposals: [],
        recommendations: []
      })),
      setSessionResponse,
      upsertProposal
    });

    handlers.handleSessionUpdated({ session: otherSession });
    handlers.handleProposal({ proposal: otherProposal });
    handlers.handleSessionUpdated({ session });
    handlers.handleProposal({ proposal });

    expect(setSessionResponse).toHaveBeenCalledOnce();
    expect(setSessionResponse).toHaveBeenCalledWith({ session });
    expect(upsertProposal).toHaveBeenCalledOnce();
    expect(upsertProposal).toHaveBeenCalledWith(proposal);
  });

  it("applies confirmed switch events for the current session", () => {
    const session = createSession("session-1", "discord");
    const proposal = {
      ...createProposal("proposal-1", session.id),
      status: "confirmed" as const,
      joinConfirmations: ["u1", "u2"]
    };
    const setSessionResponse = vi.fn();
    const upsertProposal = vi.fn();
    const handlers = createSessionSocketHandlers({
      sessionId: session.id,
      refreshSession: vi.fn(async () => ({
        session,
        proposals: [],
        recommendations: []
      })),
      setSessionResponse,
      upsertProposal
    });

    handlers.handleSwitchConfirmed({ session, proposal });

    expect(setSessionResponse).toHaveBeenCalledWith({ session });
    expect(upsertProposal).toHaveBeenCalledWith(proposal);
  });
});

function createSession(
  id: string,
  activeProvider: CallSession["activeProvider"] = "messenger"
): CallSession {
  return {
    id,
    activeProvider,
    participants: [
      { id: "u1", displayName: "Ava" },
      { id: "u2", displayName: "Ben" }
    ],
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z"
  };
}

function createProposal(id: string, sessionId: string): SwitchProposal {
  return {
    id,
    sessionId,
    fromProvider: "messenger",
    toProvider: "discord",
    reason: "streaming",
    requesterId: "u1",
    recipientId: "u2",
    status: "launching",
    acceptedBy: ["u1", "u2"],
    joinConfirmations: [],
    expiresAt: "2026-06-04T00:02:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z"
  };
}
