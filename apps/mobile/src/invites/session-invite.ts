import { SessionRoute, buildSessionRoute } from "../navigation/session-route";

export function buildSessionInviteUrl(
  sessionId: string,
  participantId: string
): string {
  return [
    "syncthia://session/",
    encodeURIComponent(sessionId),
    "?participantId=",
    encodeURIComponent(participantId)
  ].join("");
}

export function sessionRouteFromInviteUrl(url: string): SessionRoute | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "syncthia:") {
      return undefined;
    }

    const sessionId = sessionIdFromInviteUrl(parsed);
    return buildSessionRoute(sessionId, parsed.searchParams.get("participantId"));
  } catch {
    return undefined;
  }
}

function sessionIdFromInviteUrl(url: URL): string | undefined {
  if (url.hostname === "session") {
    return decodeUrlSegment(url.pathname.replace(/^\/+/, ""));
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts[0] !== "session") {
    return undefined;
  }

  return decodeUrlSegment(pathParts[1]);
}

function decodeUrlSegment(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
