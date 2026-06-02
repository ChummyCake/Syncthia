import { ProviderLaunchTarget } from "@syncthia/shared";
import * as Linking from "expo-linking";

export async function launchProvider(target: ProviderLaunchTarget): Promise<void> {
  const preferredUrl = target.appUrl ?? target.webUrl;

  if (preferredUrl !== target.webUrl && await canOpen(preferredUrl)) {
    try {
      await Linking.openURL(preferredUrl);
      return;
    } catch {
      // Fall through to the browser fallback.
    }
  }

  try {
    await Linking.openURL(target.webUrl);
  } catch (error) {
    throw new Error(
      `Could not open ${target.label}. ${target.instructions}`
    );
  }
}

async function canOpen(url: string) {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}
