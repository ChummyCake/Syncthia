import { BadRequestException, Injectable } from "@nestjs/common";
import { Provider as DbProvider, ProviderPreference } from "@prisma/client";
import {
  PROVIDERS,
  Provider,
  PreferenceSignal,
  assertProvider,
  recommendProviders
} from "@syncthia/shared";
import {
  PREFERENCE_SIGNALS,
  RegisterDeviceDto,
  UpdateProviderPreferencesDto
} from "./dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

interface ProviderPreferenceRecord {
  userId: string;
  preferredProvider?: Provider;
  installedProviders?: Provider[];
  signals: PreferenceSignal[];
  updatedAt: string;
}

@Injectable()
export class MeService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService
  ) {}

  async updateProviderPreferences(dto: UpdateProviderPreferencesDto) {
    const userId = dto.userId.trim();
    if (!userId) {
      throw new BadRequestException("User id is required.");
    }

    const preferredProvider = dto.preferredProvider
      ? this.toDbProvider(dto.preferredProvider)
      : null;
    const installedProviders = unique(
      dto.installedProviders ?? [...PROVIDERS]
    ).map((provider) => this.toDbProvider(provider));
    const signals = unique(dto.signals ?? []).map((signal) =>
      this.toPreferenceSignal(signal)
    );

    await this.ensureUser(userId);
    const preference = await this.prisma.providerPreference.upsert({
      where: { userId },
      update: {
        preferredProvider,
        installedProviders,
        signals
      },
      create: {
        userId,
        preferredProvider,
        installedProviders,
        signals
      }
    });
    const record = toProviderPreferenceRecord(preference);

    return {
      preferences: record,
      recommendations: recommendProviders(record)
    };
  }

  async registerDevice(dto: RegisterDeviceDto) {
    return {
      device: await this.notifications.registerDevice(dto)
    };
  }

  private toDbProvider(provider: Provider): DbProvider {
    try {
      return assertProvider(provider).toUpperCase() as DbProvider;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid provider."
      );
    }
  }

  private toPreferenceSignal(signal: unknown): PreferenceSignal {
    if (
      typeof signal === "string" &&
      (PREFERENCE_SIGNALS as readonly string[]).includes(signal)
    ) {
      return signal as PreferenceSignal;
    }

    throw new BadRequestException(`Unsupported preference signal: ${String(signal)}`);
  }

  private async ensureUser(userId: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        displayName: userId
      }
    });
  }
}

function toProviderPreferenceRecord(
  preference: ProviderPreference
): ProviderPreferenceRecord {
  return {
    userId: preference.userId,
    preferredProvider: preference.preferredProvider
      ? toProvider(preference.preferredProvider)
      : undefined,
    installedProviders: preference.installedProviders.map(toProvider),
    signals: preference.signals.map((signal) => signal as PreferenceSignal),
    updatedAt: preference.updatedAt.toISOString()
  };
}

function toProvider(provider: DbProvider): Provider {
  return provider.toLowerCase() as Provider;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
