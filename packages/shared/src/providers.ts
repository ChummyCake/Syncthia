export const PROVIDERS = ["messenger", "discord", "zalo"] as const;

export type Provider = (typeof PROVIDERS)[number];

export type ProviderCapability =
  | "simple_calls"
  | "long_calls"
  | "streaming"
  | "gaming"
  | "groups"
  | "vietnam_contacts";

export const PROVIDER_LABELS: Record<Provider, string> = {
  messenger: "Messenger",
  discord: "Discord",
  zalo: "Zalo"
};

export const PROVIDER_CAPABILITIES: Record<Provider, ProviderCapability[]> = {
  messenger: ["simple_calls", "long_calls"],
  discord: ["streaming", "gaming", "groups"],
  zalo: ["vietnam_contacts", "simple_calls"]
};

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

export function assertProvider(value: unknown): Provider {
  if (isProvider(value)) {
    return value;
  }

  throw new Error(`Unsupported provider: ${String(value)}`);
}

export function otherProviders(activeProvider: Provider): Provider[] {
  return PROVIDERS.filter((provider) => provider !== activeProvider);
}
