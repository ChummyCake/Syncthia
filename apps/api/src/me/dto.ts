import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PROVIDERS, Provider } from "@syncthia/shared";

export const PREFERENCE_SIGNALS = [
  "simple",
  "long_call",
  "streaming",
  "gaming",
  "group",
  "vietnam",
  "zalo_first",
  "low_data"
] as const;

export class UpdateProviderPreferencesDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsIn(PROVIDERS)
  preferredProvider?: Provider;

  @IsOptional()
  @IsArray()
  @IsIn(PROVIDERS, { each: true })
  installedProviders?: Provider[];

  @IsOptional()
  @IsArray()
  @IsIn(PREFERENCE_SIGNALS, { each: true })
  signals?: (typeof PREFERENCE_SIGNALS)[number][];
}

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  pushToken: string;

  @IsIn(["ios", "android"])
  platform: "ios" | "android";
}
