import {
  Provider,
  PROVIDER_LABELS,
  PROVIDERS,
  assertProvider
} from "./providers";

export type PreferenceSignal =
  | "simple"
  | "long_call"
  | "streaming"
  | "gaming"
  | "group"
  | "vietnam"
  | "zalo_first"
  | "low_data";

export interface RecommendationInput {
  signals: PreferenceSignal[];
  preferredProvider?: Provider;
  installedProviders?: Provider[];
  activeProvider?: Provider;
}

export interface ProviderRecommendation {
  provider: Provider;
  label: string;
  score: number;
  reasons: string[];
  isActive: boolean;
}

const BASE_SCORE: Record<Provider, number> = {
  messenger: 55,
  discord: 50,
  zalo: 45
};

export function recommendProviders(input: RecommendationInput): ProviderRecommendation[] {
  const signals = new Set(input.signals);
  const installedProviders = new Set(input.installedProviders ?? PROVIDERS);
  const preferredProvider = input.preferredProvider
    ? assertProvider(input.preferredProvider)
    : undefined;

  return PROVIDERS.map((provider) => {
    const reasons: string[] = [];
    let score = BASE_SCORE[provider];

    if (installedProviders.has(provider)) {
      score += 10;
      reasons.push("installed");
    }

    if (preferredProvider === provider) {
      score += 25;
      reasons.push("preferred");
    }

    if (provider === "messenger") {
      if (signals.has("simple")) {
        score += 20;
        reasons.push("simple personal call");
      }
      if (signals.has("long_call")) {
        score += 25;
        reasons.push("long call");
      }
      if (signals.has("low_data")) {
        score += 8;
        reasons.push("low-friction fallback");
      }
    }

    if (provider === "discord") {
      if (signals.has("streaming")) {
        score += 35;
        reasons.push("streaming");
      }
      if (signals.has("gaming")) {
        score += 25;
        reasons.push("gaming");
      }
      if (signals.has("group")) {
        score += 20;
        reasons.push("group/server context");
      }
    }

    if (provider === "zalo") {
      if (signals.has("vietnam")) {
        score += 35;
        reasons.push("Vietnam contacts");
      }
      if (signals.has("zalo_first")) {
        score += 35;
        reasons.push("Zalo-first contact");
      }
      if (signals.has("simple")) {
        score += 10;
        reasons.push("simple call");
      }
    }

    return {
      provider,
      label: PROVIDER_LABELS[provider],
      score,
      reasons,
      isActive: input.activeProvider === provider
    };
  }).sort((left, right) => right.score - left.score);
}
