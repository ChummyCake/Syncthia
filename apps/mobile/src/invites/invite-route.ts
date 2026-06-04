import { SessionRoute } from "../navigation/session-route";
import { sessionRouteFromInviteUrl } from "./session-invite";

export type InviteRoutePusher = (route: SessionRoute) => void;

export function routeInviteUrl(
  url: string | null | undefined,
  push: InviteRoutePusher
): boolean {
  if (!url) {
    return false;
  }

  const route = sessionRouteFromInviteUrl(url);
  if (!route) {
    return false;
  }

  push(route);
  return true;
}
