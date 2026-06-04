import { Body, Controller, Patch, Post } from "@nestjs/common";
import { RegisterDeviceDto, UpdateProviderPreferencesDto } from "./dto";
import { MeService } from "./me.service";
import { RateLimitService } from "../rate-limit/rate-limit.service";

const PROVIDER_PREFERENCES_LIMIT = {
  name: "me.provider-preferences",
  limit: 30,
  windowMs: 60_000
};
const DEVICE_REGISTRATION_LIMIT = {
  name: "me.devices",
  limit: 10,
  windowMs: 60_000
};

@Controller("me")
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly rateLimits: RateLimitService
  ) {}

  @Patch("provider-preferences")
  updateProviderPreferences(@Body() dto: UpdateProviderPreferencesDto) {
    this.rateLimits.assertAllowed(userKey(dto.userId), PROVIDER_PREFERENCES_LIMIT);
    return this.meService.updateProviderPreferences(dto);
  }

  @Post("devices")
  registerDevice(@Body() dto: RegisterDeviceDto) {
    this.rateLimits.assertAllowed(userKey(dto.userId), DEVICE_REGISTRATION_LIMIT);
    return this.meService.registerDevice(dto);
  }
}

function userKey(userId: string) {
  return `user:${userId}`;
}
