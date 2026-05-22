import { Body, Controller, Patch, Post } from "@nestjs/common";
import { RegisterDeviceDto, UpdateProviderPreferencesDto } from "./dto";
import { MeService } from "./me.service";

@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Patch("provider-preferences")
  updateProviderPreferences(@Body() dto: UpdateProviderPreferencesDto) {
    return this.meService.updateProviderPreferences(dto);
  }

  @Post("devices")
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.meService.registerDevice(dto);
  }
}
