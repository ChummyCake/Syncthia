import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export async function registerDeviceForPush(userId: string): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return;
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  await fetch(`${API_URL}/me/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      pushToken: token.data,
      platform: Platform.OS
    })
  });
}
