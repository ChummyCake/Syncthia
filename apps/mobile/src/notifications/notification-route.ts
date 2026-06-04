import {
  SessionRoute,
  buildSessionRoute
} from "../navigation/session-route";

export type NotificationSessionRoute = SessionRoute;

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

  return buildSessionRoute(sessionId, participantId);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
