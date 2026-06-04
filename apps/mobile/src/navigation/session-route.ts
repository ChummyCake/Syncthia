export interface SessionRoute {
  pathname: "/session/[sessionId]";
  params: {
    sessionId: string;
    participantId?: string;
  };
}

export function buildSessionRoute(
  sessionId: unknown,
  participantId?: unknown
): SessionRoute | undefined {
  const normalizedSessionId = optionalString(sessionId);
  if (!normalizedSessionId) {
    return undefined;
  }

  const normalizedParticipantId = optionalString(participantId);
  return {
    pathname: "/session/[sessionId]",
    params: {
      sessionId: normalizedSessionId,
      ...(normalizedParticipantId ? { participantId: normalizedParticipantId } : {})
    }
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
