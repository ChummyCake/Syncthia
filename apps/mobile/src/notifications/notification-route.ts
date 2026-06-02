export interface NotificationSessionRoute {
  pathname: "/session/[sessionId]";
  params: {
    sessionId: string;
    participantId?: string;
  };
}

export function notificationRouteFromData(
  data: unknown
): NotificationSessionRoute | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const sessionId = optionalString(data.sessionId);
  if (!sessionId) {
    return undefined;
  }

  const participantId =
    optionalString(data.recipientId) ?? optionalString(data.participantId);

  return {
    pathname: "/session/[sessionId]",
    params: {
      sessionId,
      ...(participantId ? { participantId } : {})
    }
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
