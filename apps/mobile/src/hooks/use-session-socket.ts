import { useEffect } from "react";
import { io } from "socket.io-client";
import { CallSession, ProviderEndpoint, SwitchProposal } from "@syncthia/shared";
import { useSessionStore } from "../store/session-store";

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

    const joinSession = () => {
      socket.emit("session.join", { sessionId });
    };

    socket.on("connect", joinSession);

    socket.on(
      "session.updated",
      ({
        session,
        providerEndpoints
      }: {
        session: CallSession;
        providerEndpoints?: ProviderEndpoint[];
      }) => {
        if (session.id !== sessionId) {
          return;
        }
        setSessionResponse({ session, providerEndpoints });
      }
    );

    const handleProposal = ({ proposal }: { proposal: SwitchProposal }) => {
      if (proposal.sessionId !== sessionId) {
        return;
      }
      upsertProposal(proposal);
    };

    socket.on("switch.proposed", handleProposal);
    socket.on("switch.accepted", handleProposal);
    socket.on("switch.rejected", handleProposal);
    socket.on("switch.expired", handleProposal);
    socket.on("switch.launching", handleProposal);
    socket.on(
      "switch.confirmed",
      ({ session, proposal }: { session: CallSession; proposal: SwitchProposal }) => {
        if (session.id !== sessionId) {
          return;
        }
        setSessionResponse({ session });
        upsertProposal(proposal);
      }
    );

    return () => {
      socket.emit("session.leave", { sessionId });
      socket.disconnect();
    };
  }, [sessionId, setSessionResponse, upsertProposal]);
}
