import { Injectable } from "@nestjs/common";
import { Provider, PreferenceSignal, recommendProviders } from "@syncthia/shared";
import { RegisterDeviceDto, UpdateProviderPreferencesDto } from "./dto";
import { NotificationsService } from "../notifications/notifications.service";

interface ProviderPreferenceRecord {
  userId: string;
  preferredProvider?: Provider;
  installedProviders?: Provider[];
  signals: PreferenceSignal[];
  updatedAt: string;
}

@Injectable()
export class MeService {
  private readonly preferences = new Map<string, ProviderPreferenceRecord>();

  constructor(private readonly notifications: NotificationsService) {}

  updateProviderPreferences(dto: UpdateProviderPreferencesDto) {
    const record: ProviderPreferenceRecord = {
      userId: dto.userId,
      preferredProvider: dto.preferredProvider,
      installedProviders: dto.installedProviders,
      signals: dto.signals ?? [],
      updatedAt: new Date().toISOString()
    };

    this.preferences.set(dto.userId, record);

    return {
      preferences: record,
      recommendations: recommendProviders(record)
    };
  }

  registerDevice(dto: RegisterDeviceDto) {
    return {
      device: this.notifications.registerDevice(dto)
    };
  }
}
