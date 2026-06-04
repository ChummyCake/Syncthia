import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { routeInviteUrl } from "./invite-route";

export function useInviteRouting() {
  useEffect(() => {
    let mounted = true;

    void Linking.getInitialURL()
      .then((url) => {
        if (mounted) {
          pushInviteUrl(url);
        }
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      pushInviteUrl(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}

function pushInviteUrl(url: string | null | undefined): boolean {
  return routeInviteUrl(url, (route) => router.replace(route));
}
