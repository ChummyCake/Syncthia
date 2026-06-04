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

export type ProviderEndpointUrlKind = "appUrl" | "webUrl";

const PROVIDER_APP_URL_SCHEMES: Record<Provider, readonly string[]> = {
  messenger: ["messenger", "fb-messenger", "https"],
  discord: ["discord", "https"],
  zalo: ["zalo", "https"]
};

const WEB_URL_SCHEMES = ["https"] as const;

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

export function assertProviderEndpointUrl(
  providerInput: Provider,
  kind: ProviderEndpointUrlKind,
  value: string
): string {
  const provider = assertProvider(providerInput);
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${PROVIDER_LABELS[provider]} ${formatUrlKind(kind)} is required.`);
  }

  const scheme = parseUrlScheme(trimmed, provider, kind);
  const allowedSchemes = kind === "webUrl"
    ? WEB_URL_SCHEMES
    : PROVIDER_APP_URL_SCHEMES[provider];

  if (!allowedSchemes.includes(scheme)) {
    throw new Error(
      `${PROVIDER_LABELS[provider]} ${formatUrlKind(kind)} must use ${formatSchemes(allowedSchemes)}.`
    );
  }

  return trimmed;
}

function parseUrlScheme(
  value: string,
  provider: Provider,
  kind: ProviderEndpointUrlKind
) {
  try {
    return new URL(value).protocol.replace(/:$/, "").toLowerCase();
  } catch {
    throw new Error(`${PROVIDER_LABELS[provider]} ${formatUrlKind(kind)} must be a valid URL.`);
  }
}

function formatUrlKind(kind: ProviderEndpointUrlKind) {
  return kind === "appUrl" ? "app URL" : "web URL";
}

function formatSchemes(schemes: readonly string[]) {
  if (schemes.length === 1) {
    return `${schemes[0]} URLs`;
  }

  return `${schemes.slice(0, -1).join(", ")}, or ${schemes[schemes.length - 1]} URLs`;
}
