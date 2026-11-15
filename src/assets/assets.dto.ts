import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccessPermission, MediaKind, MediaVisibility, ProcessingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QueryAssetsDto {
  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;

  @IsOptional()
  @IsEnum(MediaVisibility)
  visibility?: MediaVisibility;

  @IsOptional()
  @IsEnum(ProcessingStatus)
  processingStatus?: ProcessingStatus;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateAssetMetadataDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ClientAccessEntryDto {
  @IsString()
  clientSlug!: string;

  @IsOptional()
  @IsEnum(AccessPermission)
  permission?: AccessPermission;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

export class UpdateAssetAccessDto {
  @IsEnum(MediaVisibility)
  visibility!: MediaVisibility;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientAccessEntryDto)
  clients?: ClientAccessEntryDto[];
}

export class CreateSignedUrlDto {
  @ApiPropertyOptional({ default: 'full', description: 'full | thumb | original | poster | mp4_720p | audio_mp3' })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiPropertyOptional({ default: 3600, minimum: 30, maximum: 604800 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(604800)
  ttlSeconds?: number;
}
