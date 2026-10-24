import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppealStatus, ContentType, ModerationStatus } from '../moderation.enums';

export class FlagContentDto {
  @ApiProperty({ enum: ContentType })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiProperty()
  @IsUUID()
  contentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewItemDto {
  @ApiProperty({ enum: [ModerationStatus.APPROVED, ModerationStatus.REJECTED] })
  @IsEnum([ModerationStatus.APPROVED, ModerationStatus.REJECTED])
  status: ModerationStatus.APPROVED | ModerationStatus.REJECTED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AppealDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class SubmitModerationAppealDto {
  @ApiProperty()
  @IsUUID()
  moderationItemId: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ResolveModerationAppealDto {
  @ApiProperty({ enum: [AppealStatus.ACCEPTED, AppealStatus.REJECTED] })
  @IsEnum([AppealStatus.ACCEPTED, AppealStatus.REJECTED])
  status: AppealStatus.ACCEPTED | AppealStatus.REJECTED;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}

export class ModerationQueueQueryDto {
  @ApiPropertyOptional({ enum: ModerationStatus })
  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;

  @ApiPropertyOptional({ enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;
}
