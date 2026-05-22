import { ProviderLaunchTarget } from "@syncthia/shared";
import * as Linking from "expo-linking";

export async function launchProvider(target: ProviderLaunchTarget): Promise<void> {
  const preferredUrl = target.appUrl ?? target.webUrl;
  const canOpenPreferred = await Linking.canOpenURL(preferredUrl);

  if (canOpenPreferred) {
    await Linking.openURL(preferredUrl);
    return;
  }

  await Linking.openURL(target.webUrl);
}
