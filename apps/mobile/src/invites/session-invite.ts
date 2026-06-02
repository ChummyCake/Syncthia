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
