import { useEffect } from "react";
import { io } from "socket.io-client";
import { getSession } from "../lib/api";
import { useSessionStore } from "../store/session-store";
import { createSessionSocketHandlers } from "./session-socket-handlers";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:4000/sessions";

export function useSessionSocket(sessionId?: string) {
  const setSessionResponse = useSessionStore((state) => state.setSessionResponse);
  const upsertProposal = useSessionStore((state) => state.upsertProposal);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const socket = io(WS_URL, {
      transports: ["websocket"]
    });
    const handlers = createSessionSocketHandlers({
      sessionId,
      refreshSession: () => getSession(sessionId),
      setSessionResponse,
      upsertProposal
    });
    const joinSession = () => handlers.handleConnect(socket);

    socket.on("connect", joinSession);

    socket.on("session.updated", handlers.handleSessionUpdated);
    socket.on("switch.proposed", handlers.handleProposal);
    socket.on("switch.accepted", handlers.handleProposal);
    socket.on("switch.rejected", handlers.handleProposal);
    socket.on("switch.expired", handlers.handleProposal);
    socket.on("switch.launching", handlers.handleProposal);
    socket.on("switch.confirmed", handlers.handleSwitchConfirmed);

    return () => {
      handlers.deactivate();
      socket.emit("session.leave", { sessionId });
      socket.disconnect();
    };
  }, [sessionId, setSessionResponse, upsertProposal]);
}
