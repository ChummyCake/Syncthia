import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { PROVIDERS, Provider } from "@syncthia/shared";

export class ParticipantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;
}

export class ProviderEndpointDto {
  @IsIn(PROVIDERS)
  provider: Provider;

  @IsOptional()
  @IsString()
  handle?: string;

  @IsOptional()
  @IsString()
  appUrl?: string;

  @IsOptional()
  @IsString()
  webUrl?: string;
}

export class CreateSessionDto {
  @IsIn(PROVIDERS)
  activeProvider: Provider;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants: ParticipantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderEndpointDto)
  providerEndpoints?: ProviderEndpointDto[];
}

export class CreateSwitchProposalDto {
  @IsString()
  @IsNotEmpty()
  requesterId: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsIn(PROVIDERS)
  toProvider: Provider;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ParticipantActionDto {
  @IsString()
  @IsNotEmpty()
  participantId: string;
}
