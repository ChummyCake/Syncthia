import { Provider, PROVIDER_LABELS, assertProvider } from "./providers";

export interface ProviderEndpoint {
  provider: Provider;
  handle?: string;
  appUrl?: string;
  webUrl?: string;
}

export interface ProviderLaunchTarget {
  provider: Provider;
  label: string;
  appUrl?: string;
  webUrl: string;
  instructions: string;
}

export function buildProviderLaunchTarget(
  providerInput: Provider,
  endpoint?: ProviderEndpoint
): ProviderLaunchTarget {
  const provider = assertProvider(providerInput);

  if (provider === "messenger") {
    const handle = endpoint?.handle?.replace(/^@/, "");
    return {
      provider,
      label: PROVIDER_LABELS[provider],
      appUrl: endpoint?.appUrl,
      webUrl: endpoint?.webUrl ?? (handle ? `https://m.me/${handle}` : "https://www.messenger.com/"),
      instructions: "Open Messenger and join the agreed chat or call."
    };
  }

  if (provider === "discord") {
    return {
      provider,
      label: PROVIDER_LABELS[provider],
      appUrl: endpoint?.appUrl ?? endpoint?.webUrl,
      webUrl: endpoint?.webUrl ?? "https://discord.com/channels/@me",
      instructions: "Open Discord and join the agreed DM, channel, or invite."
    };
  }

  const handle = endpoint?.handle?.replace(/^@/, "");
  return {
    provider,
    label: PROVIDER_LABELS[provider],
    appUrl: endpoint?.appUrl,
    webUrl: endpoint?.webUrl ?? (handle ? `https://zalo.me/${handle}` : "https://zalo.me/"),
    instructions: "Open Zalo and join the agreed chat or call."
  };
}
