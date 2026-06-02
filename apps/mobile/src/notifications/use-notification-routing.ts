import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { notificationRouteFromData } from "./notification-route";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true
  })
});

export function useNotificationRouting() {
  useEffect(() => {
    let mounted = true;

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (mounted) {
          routeFromResponse(response);
        }
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener(
      routeFromResponse
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}

function routeFromResponse(response: Notifications.NotificationResponse | null) {
  const route = notificationRouteFromData(
    response?.notification.request.content.data
  );

  if (route) {
    router.push(route);
  }
}
